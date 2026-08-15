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
import type { Ad, FillStep } from "@/lib/p2p/orderbook";

export type OpportunityDetail = { buySteps: FillStep[]; sellSteps: FillStep[] };

/**
 * Schema Postgres próprio desta app dentro do projeto Supabase partilhado —
 * ver supabase/migrations/0001_init.sql para o porquê de não haver RLS
 * policies nem GRANTs para anon/authenticated: tudo passa pela ligação
 * directa Postgres do servidor Next.js (DATABASE_URL), nunca por PostgREST.
 */
export const meticalEdge = pgSchema("metical_edge");

export const settings = meticalEdge.table("settings", {
  id: boolean("id").primaryKey().default(true),
  currentCapitalMzn: numeric("current_capital_mzn", { precision: 14, scale: 2 }).notNull().default("0"),
  initialCapitalMzn: numeric("initial_capital_mzn", { precision: 14, scale: 2 }).notNull().default("0"),
  /** Em MZN, não percentagem — mais fácil de perceber para quem não é
   *  técnico ("só me mostra o que dá pelo menos X meticais"). Usado para
   *  simplificar a lista "Por comerciante": por omissão só mostra opções
   *  que passam este valor, o resto fica escondido atrás de "ver tudo". */
  minDisplayProfitMzn: numeric("min_display_profit_mzn", { precision: 14, scale: 2 }).notNull().default("0"),
  minNetPctAlert: numeric("min_net_pct_alert", { precision: 6, scale: 3 }).notNull().default("0.15"),
  /** Lucro LÍQUIDO mínimo, em MZN, para o sistema avisar. Zero = avisa
   *  sempre que sobrar dinheiro depois de todos os custos.
   *
   *  Antes o segundo gatilho de alerta olhava para o lucro BRUTO: chegavam
   *  avisos de oportunidades que, depois das taxas, davam prejuízo. Um
   *  limiar em Meticais sobre o líquido é o que corresponde à pergunta real
   *  ("vale a pena largar o que estou a fazer por isto?"). */
  minNetProfitAlertMzn: numeric("min_net_profit_alert_mzn", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  minGrossSpreadPct: numeric("min_gross_spread_pct", { precision: 6, scale: 3 }).notNull().default("0.6"),
  minCounterpartyFinishRate: numeric("min_counterparty_finish_rate", { precision: 5, scale: 4 }).notNull().default("0.95"),
  minCounterpartyMonthlyOrders: integer("min_counterparty_monthly_orders").notNull().default(50),
  maxOrdersPerLeg: integer("max_orders_per_leg").notNull().default(3),
  alertCooldownMinutes: integer("alert_cooldown_minutes").notNull().default(20),
  scanningEnabled: boolean("scanning_enabled").notNull().default(true),
  /** Via usada para mover Meticais nas ordens P2P. Move o cálculo de lucro
   *  de "só taxa da Binance" para o custo real: transferir e levantar
   *  dinheiro móvel custa dinheiro e antes era simplesmente ignorado
   *  (lib/p2p/fees.ts tinha as tabelas e ninguém as chamava). */
  costRail: text("cost_rail", { enum: ["nenhum", "mpesa", "emola"] }).notNull().default("mpesa"),
  /** Contar o levantamento do dinheiro no fim de cada operação. Falso por
   *  omissão: quem opera em ciclo deixa o saldo na carteira. */
  includeCashOut: boolean("include_cash_out").notNull().default(false),
  /** Transferências por ordem — alguns comerciantes pedem o valor
   *  repartido, e cada envio paga a sua taxa de escalão. */
  transfersPerOrder: integer("transfers_per_order").notNull().default(1),
  /** Alerta por SMS além do push — precisa de um número E.164 (+258...).
   *  Desligado por omissão até haver um número configurado. */
  smsAlertsEnabled: boolean("sms_alerts_enabled").notNull().default(false),
  alertPhoneE164: text("alert_phone_e164"),
  /** Capital para a arbitragem P2P internacional (lib/p2p/intl/) — separado
   *  do capital MZN acima porque são estratégias e riscos independentes.
   *  Usado para calcular o lucro estimado por oportunidade no scan. */
  intlCapitalUsd: numeric("intl_capital_usd", { precision: 14, scale: 2 }).notNull().default("30000"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Settings = typeof settings.$inferSelect;

export const snapshots = meticalEdge.table("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  bestAsk: numeric("best_ask", { precision: 10, scale: 4 }),
  bestBid: numeric("best_bid", { precision: 10, scale: 4 }),
  midPrice: numeric("mid_price", { precision: 10, scale: 4 }),
  spreadPct: numeric("spread_pct", { precision: 8, scale: 4 }),
  isCrossed: boolean("is_crossed").notNull().default(false),
  nAdsAsk: integer("n_ads_ask").notNull().default(0),
  nAdsBid: integer("n_ads_bid").notNull().default(0),
  liquidityAskUsdt: numeric("liquidity_ask_usdt", { precision: 18, scale: 4 }),
  liquidityBidUsdt: numeric("liquidity_bid_usdt", { precision: 18, scale: 4 }),
  referenceUsdMzn: numeric("reference_usd_mzn", { precision: 10, scale: 4 }),
  askAds: jsonb("ask_ads").$type<Ad[]>().notNull().default([]),
  bidAds: jsonb("bid_ads").$type<Ad[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("snapshots_collected_at_idx").on(t.collectedAt.desc()),
]);
export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;

export const opportunities = meticalEdge.table("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id").notNull().references(() => snapshots.id, { onDelete: "cascade" }),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  capitalMzn: numeric("capital_mzn", { precision: 14, scale: 2 }).notNull(),
  buyVwap: numeric("buy_vwap", { precision: 10, scale: 4 }),
  sellVwap: numeric("sell_vwap", { precision: 10, scale: 4 }),
  usdtAmount: numeric("usdt_amount", { precision: 18, scale: 8 }),
  grossProfitMzn: numeric("gross_profit_mzn", { precision: 14, scale: 2 }),
  grossPct: numeric("gross_pct", { precision: 8, scale: 4 }),
  nOrders: integer("n_orders"),
  residualUsdt: numeric("residual_usdt", { precision: 18, scale: 8 }).notNull().default("0"),
  netProfitConservativeMzn: numeric("net_profit_conservative_mzn", { precision: 14, scale: 2 }),
  netProfitMediumMzn: numeric("net_profit_medium_mzn", { precision: 14, scale: 2 }),
  netProfitOptimisticMzn: numeric("net_profit_optimistic_mzn", { precision: 14, scale: 2 }),
  netPctConservative: numeric("net_pct_conservative", { precision: 8, scale: 4 }),
  netPctMedium: numeric("net_pct_medium", { precision: 8, scale: 4 }),
  netPctOptimistic: numeric("net_pct_optimistic", { precision: 8, scale: 4 }),
  meetsEntryRules: boolean("meets_entry_rules").notNull().default(false),
  reasonsBlocked: text("reasons_blocked").array().notNull().default([]),
  status: text("status", { enum: ["detected", "alerted", "expired", "traded", "dismissed"] })
    .notNull().default("detected"),
  detail: jsonb("detail").$type<OpportunityDetail>().notNull().default({ buySteps: [], sellSteps: [] }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("opportunities_detected_at_idx").on(t.detectedAt.desc()),
  index("opportunities_status_idx").on(t.status),
]);
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;

export const alerts = meticalEdge.table("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  channel: text("channel").notNull().default("push"),
  /** Que tipo de aviso é este. Existe porque o cooldown era partilhado por
   *  TODOS os alertas: um aviso de "preço no mínimo recente" bloqueava, à
   *  janela inteira de cooldown, o aviso da oportunidade de arbitragem que
   *  aparecia logo a seguir — exactamente o alerta que interessa. Agora
   *  cada tipo tem o seu próprio cooldown. */
  kind: text("kind", { enum: ["oportunidade", "sinal_preco", "operacao_pendente", "teste"] })
    .notNull()
    .default("oportunidade"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  gatewayMessageId: text("gateway_message_id"),
  deliveryError: text("delivery_error"),
  /** Duplica como notificação dentro da app (sino no layout) — marcado
   *  quando o utilizador abre/reconhece o alerta. */
  readAt: timestamp("read_at", { withTimezone: true }),
}, (t) => [
  index("alerts_sent_at_idx").on(t.sentAt.desc()),
  index("alerts_kind_sent_at_idx").on(t.kind, t.sentAt.desc()),
]);
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export const trades = meticalEdge.table("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  capitalUsedMzn: numeric("capital_used_mzn", { precision: 14, scale: 2 }).notNull(),
  buyPrice: numeric("buy_price", { precision: 10, scale: 4 }),
  sellPrice: numeric("sell_price", { precision: 10, scale: 4 }),
  usdtAmount: numeric("usdt_amount", { precision: 18, scale: 8 }),
  grossProfitMzn: numeric("gross_profit_mzn", { precision: 14, scale: 2 }),
  feesPaidMzn: numeric("fees_paid_mzn", { precision: 14, scale: 2 }).notNull().default("0"),
  netProfitMzn: numeric("net_profit_mzn", { precision: 14, scale: 2 }).notNull(),
  outcome: text("outcome", { enum: ["success", "partial", "loss"] }).notNull().default("success"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("trades_executed_at_idx").on(t.executedAt.desc()),
]);
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

/**
 * Operação de duas pernas em curso: compra já feita, venda ainda por
 * encontrar. Existe porque nem sempre a compra e a venda acontecem juntas —
 * às vezes o preço de venda bom desaparece entretanto, e o capital fica
 * "preso" nesta operação até aparecer um comprador ao preço-alvo (ou
 * melhor). O motor de scan (lib/p2p/scan.ts) vigia isto e avisa sozinho.
 * Ao finalizar, gera uma linha em `trades` (histórico) e faz o capital
 * evoluir — mesma lógica de lib/actions/trades.ts, só que em dois passos.
 */
export const pendingOperations = meticalEdge.table("pending_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  status: text("status", { enum: ["aguardando_venda", "concluida", "cancelada"] })
    .notNull().default("aguardando_venda"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),

  // Perna de compra — preenchida ao iniciar a operação.
  capitalUsedMzn: numeric("capital_used_mzn", { precision: 14, scale: 2 }).notNull(),
  buyPrice: numeric("buy_price", { precision: 10, scale: 4 }).notNull(),
  usdtAmount: numeric("usdt_amount", { precision: 18, scale: 8 }).notNull(),

  /** Preço de venda que tornava a operação lucrativa quando foi iniciada —
   *  o scan usa isto para saber quando voltar a avisar ("apareceu alguém a
   *  pagar isto ou mais"). */
  targetSellPrice: numeric("target_sell_price", { precision: 10, scale: 4 }),

  // Perna de venda — preenchida só ao finalizar.
  sellPrice: numeric("sell_price", { precision: 10, scale: 4 }),
  mznReceivedGross: numeric("mzn_received_gross", { precision: 14, scale: 2 }),
  feesPaidMzn: numeric("fees_paid_mzn", { precision: 14, scale: 2 }),
  netProfitMzn: numeric("net_profit_mzn", { precision: 14, scale: 2 }),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "set null" }),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("pending_operations_status_idx").on(t.status),
  index("pending_operations_started_at_idx").on(t.startedAt.desc()),
]);
export type PendingOperation = typeof pendingOperations.$inferSelect;
export type NewPendingOperation = typeof pendingOperations.$inferInsert;

export const capitalLedger = meticalEdge.table("capital_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  deltaMzn: numeric("delta_mzn", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "set null" }),
  resultingBalanceMzn: numeric("resulting_balance_mzn", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("capital_ledger_changed_at_idx").on(t.changedAt.desc()),
]);
export type CapitalLedgerEntry = typeof capitalLedger.$inferSelect;

/**
 * Arbitragem P2P internacional (USDT/NGN, USDT/BRL, ...) — Fase 1
 * (validação de mercado, ver .planning/PHASE1_PLAN.md). Tabela própria,
 * independente do motor USDT/MZN acima: fiats diferentes, sem capital real
 * nem execução nesta fase, só recolha de spreads entre duas plataformas
 * P2P para o mesmo par/fiat.
 */
export const intlOpportunities = meticalEdge.table("intl_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  pair: text("pair").notNull(), // "USDT/NGN"
  region: text("region").notNull(), // "Nigeria"
  platformBuy: text("platform_buy").notNull(), // "binance_p2p"
  platformSell: text("platform_sell").notNull(), // "bybit_p2p"
  bestAsk: numeric("best_ask", { precision: 18, scale: 4 }), // preço de compra na platformBuy
  bestBid: numeric("best_bid", { precision: 18, scale: 4 }), // preço de venda na platformSell
  spreadGrossPct: numeric("spread_gross_pct", { precision: 8, scale: 4 }),
  spreadNetPct: numeric("spread_net_pct", { precision: 8, scale: 4 }),
  capitalUsd: numeric("capital_usd", { precision: 14, scale: 2 }).notNull(),
  profitAtCapitalUsd: numeric("profit_at_capital_usd", { precision: 14, scale: 2 }),
  isViable: boolean("is_viable").notNull().default(false),
  nAdsBuy: integer("n_ads_buy").notNull().default(0),
  nAdsSell: integer("n_ads_sell").notNull().default(0),
  raw: jsonb("raw"), // topo dos anúncios de cada lado, para auditoria
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("intl_opportunities_pair_collected_at_idx").on(t.pair, t.collectedAt.desc()),
  index("intl_opportunities_viable_collected_at_idx").on(t.isViable, t.collectedAt.desc()),
]);
export type IntlOpportunity = typeof intlOpportunities.$inferSelect;
export type NewIntlOpportunity = typeof intlOpportunities.$inferInsert;

/**
 * Registo manual de ciclos de arbitragem internacional executados —
 * equivalente a `trades` (USDT/MZN) acima, mas sem ledger de capital
 * automático: aqui é só histórico para comparar lucro real vs. o estimado
 * por `intlOpportunities`, o capital em settings.intlCapitalUsd continua a
 * ajustar-se manualmente em /settings.
 */
export const intlTrades = meticalEdge.table("intl_trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  pair: text("pair").notNull(),
  region: text("region").notNull(),
  platformBuy: text("platform_buy").notNull(),
  platformSell: text("platform_sell").notNull(),
  buyPrice: numeric("buy_price", { precision: 18, scale: 4 }).notNull(),
  sellPrice: numeric("sell_price", { precision: 18, scale: 4 }).notNull(),
  capitalUsedUsd: numeric("capital_used_usd", { precision: 14, scale: 2 }).notNull(),
  feesPaidUsd: numeric("fees_paid_usd", { precision: 14, scale: 2 }).notNull().default("0"),
  netProfitUsd: numeric("net_profit_usd", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("intl_trades_executed_at_idx").on(t.executedAt.desc()),
]);
export type IntlTrade = typeof intlTrades.$inferSelect;
export type NewIntlTrade = typeof intlTrades.$inferInsert;

/** Registo de qualquer erro do lado do servidor — apanhado globalmente por
 *  instrumentation.ts (onRequestError), não precisa de try/catch manual
 *  espalhado pelo código. Mesmo padrão do "payment gateway" (error_logs). */
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
