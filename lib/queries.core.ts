import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  alerts,
  botHeartbeats,
  botSettings,
  capitalLedger,
  errorLogs,
  exchangeBalances,
  exchangeHealth,
  opportunities,
  paperBalances,
  tradeEvents,
  trades,
  type ExchangeId,
} from "@/db/schema";

/**
 * Implementação sem `import "server-only"` — mesmo motivo do
 * lib/errorLog.core.ts: o worker (corrido via `tsx`, fora do bundler do
 * Next.js) precisa de importar estas leituras directamente. lib/queries.ts
 * reexporta tudo com o guard para o lado Next.js.
 */

export async function getBotSettings() {
  const [row] = await db.select().from(botSettings).where(eq(botSettings.id, true)).limit(1);
  return row;
}

export async function getHeartbeat() {
  const [row] = await db.select().from(botHeartbeats).where(eq(botHeartbeats.id, true)).limit(1);
  return row;
}

export async function getExchangeBalances() {
  return db.select().from(exchangeBalances);
}

export async function getTotalCapitalUsdt(): Promise<number> {
  const rows = await getExchangeBalances();
  return rows.reduce((sum, r) => sum + Number(r.totalValueUsdt), 0);
}

export async function getPaperBalances() {
  return db.select().from(paperBalances);
}

export async function getExchangeHealth() {
  return db.select().from(exchangeHealth);
}

export async function getTradeEvents(tradeId: string) {
  return db.select().from(tradeEvents).where(eq(tradeEvents.tradeId, tradeId)).orderBy(tradeEvents.at);
}

/** Todos os eventos das operações recentes de um modo (real/paper), já
 *  agrupados por trade — alimenta a "waterfall" expansível no histórico
 *  sem um pedido por linha. */
export async function getTradeEventsMap(isPaper = false, limit = 500): Promise<Record<string, { at: Date; event: string; detail: string | null }[]>> {
  const rows = await db
    .select({ tradeId: tradeEvents.tradeId, at: tradeEvents.at, event: tradeEvents.event, detail: tradeEvents.detail })
    .from(tradeEvents)
    .innerJoin(trades, eq(tradeEvents.tradeId, trades.id))
    .where(eq(trades.isPaper, isPaper))
    .orderBy(trades.startedAt, tradeEvents.at)
    .limit(limit * 12);

  const map: Record<string, { at: Date; event: string; detail: string | null }[]> = {};
  for (const row of rows) {
    (map[row.tradeId] ??= []).push({ at: row.at, event: row.event, detail: row.detail });
  }
  return map;
}

export async function getRecentOpportunities(limit = 100) {
  return db.select().from(opportunities).orderBy(desc(opportunities.detectedAt)).limit(limit);
}

export const getRecentOpportunitiesSummary = getRecentOpportunities;
export type OpportunitySummary = Awaited<ReturnType<typeof getRecentOpportunities>>[number];

export async function getOpportunityById(id: string) {
  const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
  return row;
}

export async function getRecentAlerts(limit = 10) {
  return db.select().from(alerts).orderBy(desc(alerts.sentAt)).limit(limit);
}

export async function getUnreadAlertsCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(sql`${alerts.readAt} is null`);
  return row?.count ?? 0;
}

export async function getRecentTrades(limit = 200, isPaper = false) {
  return db.select().from(trades).where(eq(trades.isPaper, isPaper)).orderBy(desc(trades.startedAt)).limit(limit);
}

export async function getRecentErrorLogs(limit = 30) {
  return db.select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(limit);
}

/** Série combinada de capital total (as duas exchanges somadas) — cada
 *  trade grava sempre uma linha por exchange partilhando o mesmo
 *  `changedAt` (ver lib/execution/executor.ts), por isso somar por
 *  timestamp exacto dá sempre o total correcto nesse instante. */
export async function getCapitalHistory(limit = 200, isPaper = false) {
  const rows = await db
    .select({
      changedAt: capitalLedger.changedAt,
      resultingBalanceUsdt: sql<string>`sum(${capitalLedger.resultingBalanceUsdt})`,
    })
    .from(capitalLedger)
    .where(eq(capitalLedger.isPaper, isPaper))
    .groupBy(capitalLedger.changedAt)
    .orderBy(desc(capitalLedger.changedAt))
    .limit(limit);

  return rows
    .map((r) => ({ changedAt: r.changedAt, resultingBalanceUsdt: Number(r.resultingBalanceUsdt) }))
    .reverse();
}

/** Maior queda desde o pico, sobre a série de capital combinado — métrica
 *  de risco tipo "drawdown" que os bots profissionais mostram sempre.
 *  Recebe o histórico já obtido (não rebusca) — quem chamar já tem
 *  `getCapitalHistory` no mesmo `Promise.all`, refazer a query aqui
 *  duplicava trabalho no caminho crítico do painel. */
export function getMaxDrawdown(history: { changedAt: Date; resultingBalanceUsdt: number }[]): { maxDrawdownUsdt: number; maxDrawdownPct: number } {
  let peak = -Infinity;
  let maxDrawdownUsdt = 0;
  let maxDrawdownPct = 0;
  for (const point of history) {
    peak = Math.max(peak, point.resultingBalanceUsdt);
    const drawdown = peak - point.resultingBalanceUsdt;
    if (drawdown > maxDrawdownUsdt) {
      maxDrawdownUsdt = drawdown;
      maxDrawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;
    }
  }
  return { maxDrawdownUsdt, maxDrawdownPct };
}

export async function getRecentCapitalLedgerEntries(limit = 15) {
  return db.select().from(capitalLedger).orderBy(desc(capitalLedger.changedAt)).limit(limit);
}

export type TradeStats = {
  totalTrades: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  totalProfitUsdt: number;
};

export async function getTradeStats(isPaper = false): Promise<TradeStats> {
  const rows = await db
    .select({ outcome: trades.outcome, profitRealUsdt: trades.profitRealUsdt })
    .from(trades)
    .where(eq(trades.isPaper, isPaper));

  const totalTrades = rows.length;
  const successCount = rows.filter((r) => r.outcome === "success").length;
  const partialCount = rows.filter((r) => r.outcome === "partial_recovered").length;
  const failedCount = rows.filter((r) => r.outcome === "failed").length;
  const winCount = rows.filter((r) => Number(r.profitRealUsdt) > 0).length;
  const lossCount = rows.filter((r) => Number(r.profitRealUsdt) <= 0).length;
  const totalProfitUsdt = rows.reduce((sum, r) => sum + Number(r.profitRealUsdt), 0);

  return {
    totalTrades,
    successCount,
    partialCount,
    failedCount,
    winCount,
    lossCount,
    winRatePct: totalTrades > 0 ? (winCount / totalTrades) * 100 : 0,
    totalProfitUsdt,
  };
}

export async function getTodayNetProfitUsdt(isPaper = false): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ profitRealUsdt: trades.profitRealUsdt })
    .from(trades)
    .where(and(gte(trades.startedAt, since), eq(trades.isPaper, isPaper)));
  return rows.reduce((sum, r) => sum + Number(r.profitRealUsdt), 0);
}

/** Spread bruto histórico por par, reaproveitando o que já é guardado em
 *  `opportunities.grossSpreadPct` a cada avaliação — sem tabela nova. */
export async function getSpreadHistory(pair: string, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db
    .select({ detectedAt: opportunities.detectedAt, grossSpreadPct: opportunities.grossSpreadPct, netPct: opportunities.netPct })
    .from(opportunities)
    .where(and(eq(opportunities.pair, pair), gte(opportunities.detectedAt, since)))
    .orderBy(opportunities.detectedAt);

  return rows.map((r) => ({
    detectedAt: r.detectedAt,
    grossSpreadPct: Number(r.grossSpreadPct ?? 0),
    netPct: Number(r.netPct ?? 0),
  }));
}

export async function getOpportunityCounts(sinceHours = 24) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      passed: sql<number>`count(*) filter (where ${opportunities.passedFilters})::int`,
    })
    .from(opportunities)
    .where(gte(opportunities.detectedAt, since));

  const total = row?.total ?? 0;
  const passed = row?.passed ?? 0;
  return { total, passed, rejected: total - passed };
}

export async function getTopRejectReasons(sinceHours = 24, limit = 5) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    select reason, count(*)::int as count
    from "metical_edge"."opportunities", unnest(reject_reasons) as reason
    where detected_at >= ${since} and not passed_filters
    group by reason
    order by count desc
    limit ${limit}
  `);
  return rows as unknown as { reason: string; count: number }[];
}

/** Secção 26 — desempenho por rota (exchange de compra -> exchange de
 *  venda). */
export async function getPerformanceByRoute() {
  const rows = await db
    .select({
      buyExchange: trades.buyExchange,
      sellExchange: trades.sellExchange,
      count: sql<number>`count(*)::int`,
      avgProfitPct: sql<string>`avg(case when ${trades.capitalUsdt} > 0 then ${trades.profitRealUsdt} / ${trades.capitalUsdt} * 100 else 0 end)`,
    })
    .from(trades)
    .groupBy(trades.buyExchange, trades.sellExchange);

  return rows.map((r) => ({
    buyExchange: r.buyExchange as ExchangeId,
    sellExchange: r.sellExchange as ExchangeId,
    count: r.count,
    avgProfitPct: Number(r.avgProfitPct ?? 0),
  }));
}

/** Secção 27 — desempenho por par. */
export async function getPerformanceByPair() {
  const rows = await db
    .select({
      pair: trades.pair,
      count: sql<number>`count(*)::int`,
      avgProfitPct: sql<string>`avg(case when ${trades.capitalUsdt} > 0 then ${trades.profitRealUsdt} / ${trades.capitalUsdt} * 100 else 0 end)`,
    })
    .from(trades)
    .groupBy(trades.pair)
    .orderBy(sql`count(*) desc`);

  return rows.map((r) => ({ pair: r.pair, count: r.count, avgProfitPct: Number(r.avgProfitPct ?? 0) }));
}

export async function isWithinDailyLossLimitNow(dailyLossLimitUsdt: number): Promise<boolean> {
  const todayNet = await getTodayNetProfitUsdt();
  return todayNet > -dailyLossLimitUsdt;
}

export { and, desc, eq, gte };
