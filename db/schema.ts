import {
  pgSchema,
  uuid,
  numeric,
  integer,
  boolean,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Schema Postgres próprio desta app dentro do projeto Supabase partilhado —
 * ver supabase/migrations/0001_rls_and_constraints.sql para o porquê de não
 * haver RLS policies nem GRANTs para anon/authenticated: tudo passa pela
 * ligação directa Postgres do servidor Next.js e do worker (DATABASE_URL),
 * nunca por PostgREST.
 */
export const meticalEdge = pgSchema("metical_edge");

export type ExchangeId = "binance" | "bybit";

export const botSettings = meticalEdge.table("bot_settings", {
  id: boolean("id").primaryKey().default(true),

  /** Interruptor explícito paper/live — nunca infere de haver ou não
   *  chaves API configuradas. Em "paper", o worker nunca chama
   *  `placeMarketOrder`, mesmo que as chaves estejam presentes. */
  mode: text("mode", { enum: ["paper", "live"] }).notNull().default("paper"),

  /** Soma dos dois depósitos iniciais (Binance + Bybit) — definida uma vez
   *  no onboarding, base para o cálculo de ROI (secção 25). O saldo *actual*
   *  nunca vive aqui: é sempre a soma ao vivo de `exchange_balances`, para
   *  nunca haver duas fontes de verdade a dessincronizar. */
  initialBalanceUsdt: numeric("initial_balance_usdt", { precision: 18, scale: 8 }).notNull().default("0"),

  /** % do saldo livre (da exchange compradora nesse ciclo) usado por
   *  operação (secção 13 — TRADE_SIZE_PERCENTAGE). */
  tradeSizePct: numeric("trade_size_pct", { precision: 5, scale: 2 }).notNull().default("10.00"),
  /** Tecto absoluto por operação em USDT, independente da percentagem. */
  maxTradeUsdt: numeric("max_trade_usdt", { precision: 18, scale: 8 }).notNull().default("2.00000000"),

  /** Lucro líquido mínimo exigido, antes da margem de segurança (secção 7 —
   *  MIN_PROFIT_PERCENTAGE). */
  minProfitPct: numeric("min_profit_pct", { precision: 6, scale: 3 }).notNull().default("0.100"),
  /** Margem de segurança adicional (secção 7 — SAFETY_MARGIN_PERCENTAGE):
   *  uma oportunidade só passa se `netPct >= minProfitPct + minSafetyMarginPct`,
   *  para absorver variação de preço/slippage entre avaliação e execução. */
  minSafetyMarginPct: numeric("min_safety_margin_pct", { precision: 6, scale: 3 }).notNull().default("0.150"),
  /** Taxa taker assumida por perna quando ainda não há chaves API para ler a
   *  taxa real da conta em cada exchange. */
  assumedTakerFeePct: numeric("assumed_taker_fee_pct", { precision: 6, scale: 4 }).notNull().default("0.1000"),
  /** Tempo máximo entre disparar as duas pernas e confirmar ambas antes de
   *  accionar o Recovery Engine (secção 10 — MAX_EXECUTION_TIME). */
  maxExecutionTimeMs: integer("max_execution_time_ms").notNull().default(15000),

  /** Protecção de capital (secção 31). */
  dailyLossLimitUsdt: numeric("daily_loss_limit_usdt", { precision: 18, scale: 8 }).notNull().default("1.00000000"),
  /** Perda máxima aceitável numa única operação — independente do limite
   *  diário agregado (roteiro P0 "perda máxima por operação"). */
  maxTradeLossUsdt: numeric("max_trade_loss_usdt", { precision: 18, scale: 8 }).notNull().default("1.00000000"),
  maxConsecutiveErrors: integer("max_consecutive_errors").notNull().default(3),
  /** Perdas reais seguidas (não erros técnicos) — uma sequência de trades
   *  que "correm bem" mas dão sempre prejuízo não activa
   *  maxConsecutiveErrors, só isto. */
  maxConsecutiveLosses: integer("max_consecutive_losses").notNull().default(3),
  killSwitchEngaged: boolean("kill_switch_engaged").notNull().default(false),
  killSwitchReason: text("kill_switch_reason"),

  /** Pares vigiados nas duas exchanges (secção 17), ex. "BTCUSDT". */
  watchedPairs: text("watched_pairs").array().notNull().default(["BTCUSDT", "ETHUSDT"]),

  scanningEnabled: boolean("scanning_enabled").notNull().default(true),

  /** Alerta por SMS além do push — precisa de um número E.164 (+258...). */
  smsAlertsEnabled: boolean("sms_alerts_enabled").notNull().default(false),
  alertPhoneE164: text("alert_phone_e164"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type BotSettings = typeof botSettings.$inferSelect;

/** Um activo detido numa exchange, para o detalhe de carteira do painel
 *  (secção "visibilidade de carteiras") — não usado em cálculos, só
 *  visualização. */
export type AssetBalanceDetail = {
  asset: string;
  free: number;
  locked: number;
  valueUsdt: number;
};

/** Cache de visualização do saldo por exchange (painel, secção 22) — nunca a
 *  fonte de verdade: antes de executar, o saldo/inventário é sempre
 *  reconfirmado ao vivo contra a API da própria exchange. O worker
 *  actualiza esta tabela a cada iteração do loop. */
export const exchangeBalances = meticalEdge.table("exchange_balances", {
  exchangeId: text("exchange_id", { enum: ["binance", "bybit"] }).primaryKey(),
  /** USDT livre para comprar nessa exchange. */
  usdtFree: numeric("usdt_free", { precision: 18, scale: 8 }).notNull().default("0"),
  /** USDT + activos ao preço actual — valor total de portefólio nessa
   *  exchange, usado no cartão "Capital" do painel. */
  totalValueUsdt: numeric("total_value_usdt", { precision: 18, scale: 8 }).notNull().default("0"),
  /** Todos os activos detidos (não só USDT), para o painel mostrar a
   *  carteira completa, não só o total. */
  assetsDetail: jsonb("assets_detail").$type<AssetBalanceDetail[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ExchangeBalance = typeof exchangeBalances.$inferSelect;

/** Capital simulado (paper trading) — forma idêntica a `exchange_balances`
 *  mas um universo completamente à parte, nunca lido/escrito pelo
 *  executor real. Seed a 10 USDT cada (secção 1 do desenho original). */
export const paperBalances = meticalEdge.table("paper_balances", {
  exchangeId: text("exchange_id", { enum: ["binance", "bybit"] }).primaryKey(),
  usdtFree: numeric("usdt_free", { precision: 18, scale: 8 }).notNull().default("10"),
  totalValueUsdt: numeric("total_value_usdt", { precision: 18, scale: 8 }).notNull().default("10"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type PaperBalance = typeof paperBalances.$inferSelect;

/** Saúde da ligação a cada exchange — actualizado a cada chamada que o
 *  worker faz aos adaptadores (`lib/exchange/health.ts`), para o painel
 *  mostrar latência e último erro sem teres de ir aos logs. */
export const exchangeHealth = meticalEdge.table("exchange_health", {
  exchangeId: text("exchange_id", { enum: ["binance", "bybit"] }).primaryKey(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  avgLatencyMs: integer("avg_latency_ms"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ExchangeHealthRow = typeof exchangeHealth.$inferSelect;

export const opportunities = meticalEdge.table("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  pair: text("pair").notNull(),
  buyExchange: text("buy_exchange", { enum: ["binance", "bybit"] }).notNull(),
  sellExchange: text("sell_exchange", { enum: ["binance", "bybit"] }).notNull(),
  buyPrice: numeric("buy_price", { precision: 18, scale: 8 }).notNull(),
  sellPrice: numeric("sell_price", { precision: 18, scale: 8 }).notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull(),
  capitalUsdt: numeric("capital_usdt", { precision: 18, scale: 8 }).notNull(),
  /** Spread bruto entre topo dos dois livros, antes de taxas/slippage. */
  grossSpreadPct: numeric("gross_spread_pct", { precision: 8, scale: 4 }),
  feesPct: numeric("fees_pct", { precision: 8, scale: 4 }),
  estimatedSlippagePct: numeric("estimated_slippage_pct", { precision: 8, scale: 4 }),
  netResultUsdt: numeric("net_result_usdt", { precision: 18, scale: 8 }),
  netPct: numeric("net_pct", { precision: 8, scale: 4 }),
  liquidityOk: boolean("liquidity_ok").notNull().default(false),
  passedFilters: boolean("passed_filters").notNull().default(false),
  rejectReasons: text("reject_reasons").array().notNull().default([]),
  status: text("status", { enum: ["detected", "executed", "rejected", "expired"] })
    .notNull()
    .default("detected"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("opportunities_detected_at_idx").on(t.detectedAt.desc()),
  index("opportunities_status_idx").on(t.status),
]);
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;

export const trades = meticalEdge.table("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  pair: text("pair").notNull(),
  buyExchange: text("buy_exchange", { enum: ["binance", "bybit"] }).notNull(),
  sellExchange: text("sell_exchange", { enum: ["binance", "bybit"] }).notNull(),
  buyOrderId: text("buy_order_id"),
  sellOrderId: text("sell_order_id"),
  /** IDs que nós geramos e enviamos à exchange (newClientOrderId /
   *  orderLinkId) — persistidos antes de disparar as ordens, para que uma
   *  reconciliação depois de um crash consiga perguntar à exchange "isto
   *  chegou a acontecer?" mesmo sem ainda termos o orderId de resposta. */
  buyClientOrderId: text("buy_client_order_id"),
  sellClientOrderId: text("sell_client_order_id"),
  buyPrice: numeric("buy_price", { precision: 18, scale: 8 }),
  sellPrice: numeric("sell_price", { precision: 18, scale: 8 }),
  quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull(),
  capitalUsdt: numeric("capital_usdt", { precision: 18, scale: 8 }).notNull(),
  buyFeeUsdt: numeric("buy_fee_usdt", { precision: 18, scale: 8 }),
  sellFeeUsdt: numeric("sell_fee_usdt", { precision: 18, scale: 8 }),
  slippageEstimatedPct: numeric("slippage_estimated_pct", { precision: 8, scale: 4 }),
  slippageRealPct: numeric("slippage_real_pct", { precision: 8, scale: 4 }),
  /** Só o spread, sem custos — o tecto teórico (secção 28). */
  profitTheoreticalUsdt: numeric("profit_theoretical_usdt", { precision: 18, scale: 8 }),
  /** Da oportunidade reavaliada mesmo antes de disparar as ordens. */
  profitEstimatedUsdt: numeric("profit_estimated_usdt", { precision: 18, scale: 8 }),
  /** O que realmente aconteceu, depois de taxas e preenchimento reais. */
  profitRealUsdt: numeric("profit_real_usdt", { precision: 18, scale: 8 }).notNull().default("0"),
  /** partial_recovered = uma perna falhou/preencheu a menos e a única
   *  retentativa (secção 9) também não fechou o ciclo por completo — fica
   *  um desequilíbrio entre as duas exchanges, sinalizado ao Rebalancing
   *  Monitor, nunca escondido. in_progress = linha criada antes de
   *  disparar as ordens (estado persistente entre pernas) — se o processo
   *  morrer aqui, uma linha assim fica para a reconciliação no arranque
   *  seguinte do worker encontrar e fechar. */
  outcome: text("outcome", { enum: ["in_progress", "success", "partial_recovered", "failed"] }).notNull().default("in_progress"),
  errorMessage: text("error_message"),
  executionTimeMs: integer("execution_time_ms"),
  /** true = simulado (paper trading), nunca dinheiro real — nunca aparece
   *  misturado com trades reais em nenhuma estatística por omissão. */
  isPaper: boolean("is_paper").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("trades_started_at_idx").on(t.startedAt.desc()),
  index("trades_is_paper_idx").on(t.isPaper),
]);
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

/** Registo granular de cada passo de uma execução (real ou simulada) — a
 *  "waterfall" que o painel mostra por trade, e ao mesmo tempo o audit
 *  log que faltava (checklist de go-live, secção 23). */
export const tradeEvents = meticalEdge.table("trade_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeId: uuid("trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  event: text("event").notNull(),
  detail: text("detail"),
}, (t) => [
  index("trade_events_trade_id_idx").on(t.tradeId, t.at),
]);
export type TradeEvent = typeof tradeEvents.$inferSelect;

export const capitalLedger = meticalEdge.table("capital_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  /** Qual exchange mudou — cada trade grava uma entrada por exchange
   *  afectada, já que as duas pernas mexem em saldos independentes. */
  exchangeId: text("exchange_id", { enum: ["binance", "bybit"] }).notNull(),
  deltaUsdt: numeric("delta_usdt", { precision: 18, scale: 8 }).notNull(),
  reason: text("reason").notNull(),
  tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "set null" }),
  resultingBalanceUsdt: numeric("resulting_balance_usdt", { precision: 18, scale: 8 }).notNull(),
  /** true = evolução do capital simulado (paper trading) — nunca somado
   *  ao gráfico de capital real. */
  isPaper: boolean("is_paper").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("capital_ledger_changed_at_idx").on(t.changedAt.desc()),
]);
export type CapitalLedgerEntry = typeof capitalLedger.$inferSelect;

export const alerts = meticalEdge.table("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  channel: text("channel").notNull().default("push"),
  kind: text("kind", {
    enum: [
      "execucao",
      "lucro",
      "perda",
      "erro",
      "saldo_atualizado",
      "bot_parado",
      "limite_perda",
      "oportunidade_importante",
      "teste",
    ],
  })
    .notNull()
    .default("execucao"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  gatewayMessageId: text("gateway_message_id"),
  deliveryError: text("delivery_error"),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (t) => [
  index("alerts_sent_at_idx").on(t.sentAt.desc()),
  index("alerts_kind_sent_at_idx").on(t.kind, t.sentAt.desc()),
]);
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

/** Linha única (como bot_settings) actualizada a cada iteração do loop do
 *  worker — não um histórico, só "estado agora". Usada pelo dashboard e
 *  pelo heartbeat-check em /api/cron/scan para detectar que o worker parou
 *  de responder. `status` cobre a máquina de estados da secção 23;
 *  `rebalanceRecommended`/`rebalanceReason` são o Rebalancing Monitor da
 *  secção 14 — só informa, nunca transfere capital sozinho. */
export const botHeartbeats = meticalEdge.table("bot_heartbeats", {
  id: boolean("id").primaryKey().default(true),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  opportunitiesEvaluated: integer("opportunities_evaluated").notNull().default(0),
  bestNetPct: numeric("best_net_pct", { precision: 8, scale: 4 }),
  status: text("status", {
    enum: [
      "scanning",
      "opportunity_found",
      "validating",
      "executing",
      "partially_filled",
      "completed",
      "recovery",
      "paused",
      "error",
    ],
  })
    .notNull()
    .default("scanning"),
  statusDetail: text("status_detail"),
  rebalanceRecommended: boolean("rebalance_recommended").notNull().default(false),
  rebalanceReason: text("rebalance_reason"),
  /** Perdas reais seguidas em trades reais (nunca paper) — persistido
   *  para sobreviver a um restart do worker, ao contrário do contador de
   *  erros técnicos que é só em memória. */
  consecutiveLosses: integer("consecutive_losses").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type BotHeartbeat = typeof botHeartbeats.$inferSelect;

/** Lock por lease para garantir uma única instância do worker de cada vez
 *  (roteiro P0). Não usa `pg_advisory_lock` porque `DATABASE_URL` aponta
 *  ao transaction pooler do Supabase, onde locks consultivos por sessão
 *  não são fiáveis (a sessão não fica garantidamente presa à mesma
 *  ligação entre queries). Em vez disso: uma linha, um "dono" (UUID
 *  aleatório por processo), e um heartbeat — se o dono não actualizar o
 *  heartbeat durante mais de ~30s (crash, kill -9), a lease expira
 *  sozinha e outra instância pode assumir sem intervenção manual. */
export const workerLock = meticalEdge.table("worker_lock", {
  id: boolean("id").primaryKey().default(true),
  holderId: text("holder_id"),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
});
export type WorkerLock = typeof workerLock.$inferSelect;

/** Registo de qualquer erro do lado do servidor — apanhado globalmente por
 *  instrumentation.ts (onRequestError), não precisa de try/catch manual
 *  espalhado pelo código. */
export const errorLogs = meticalEdge.table("error_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  message: text("message").notNull(),
  details: jsonb("details"),
  stack: text("stack"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("error_logs_created_at_idx").on(t.createdAt.desc()),
]);
export type ErrorLogEntry = typeof errorLogs.$inferSelect;
