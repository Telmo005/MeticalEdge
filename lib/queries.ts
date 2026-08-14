import "server-only";
import { desc, eq, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { settings, snapshots, opportunities, trades, alerts, capitalLedger, errorLogs, pendingOperations, intlOpportunities } from "@/db/schema";

/** Arbitragem P2P internacional (Fase 1) — tabela independente do motor
 *  USDT/MZN acima, ver lib/p2p/intl/scan.ts. */
export async function getRecentIntlOpportunities(limit = 400) {
  return db.select().from(intlOpportunities).orderBy(desc(intlOpportunities.collectedAt)).limit(limit);
}

export async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, true)).limit(1);
  return row;
}

export async function getLatestSnapshot() {
  const [row] = await db.select().from(snapshots).orderBy(desc(snapshots.collectedAt)).limit(1);
  return row ?? null;
}

export async function getLatestOpportunity() {
  const [row] = await db.select().from(opportunities).orderBy(desc(opportunities.detectedAt)).limit(1);
  return row ?? null;
}

export async function getRecentOpportunities(limit = 20) {
  return db.select().from(opportunities).orderBy(desc(opportunities.detectedAt)).limit(limit);
}

/**
 * Versão sem a coluna `detail` (o plano de execução completo, em JSONB).
 * O painel carregava 200 oportunidades COM esse JSON só para desenhar uma
 * tabela de cinco colunas que não o usa — dezenas de megabytes de anúncios
 * lidos e serializados a cada visita à página inicial.
 */
export async function getRecentOpportunitiesSummary(limit = 100) {
  return db
    .select({
      id: opportunities.id,
      detectedAt: opportunities.detectedAt,
      capitalMzn: opportunities.capitalMzn,
      buyVwap: opportunities.buyVwap,
      sellVwap: opportunities.sellVwap,
      netProfitMediumMzn: opportunities.netProfitMediumMzn,
      netPctMedium: opportunities.netPctMedium,
      nOrders: opportunities.nOrders,
      meetsEntryRules: opportunities.meetsEntryRules,
      status: opportunities.status,
    })
    .from(opportunities)
    .orderBy(desc(opportunities.detectedAt))
    .limit(limit);
}

export type OpportunitySummary = Awaited<ReturnType<typeof getRecentOpportunitiesSummary>>[number];

export async function getOpportunityById(id: string) {
  const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
  return row ?? null;
}

export async function getRecentAlerts(limit = 10) {
  return db.select().from(alerts).orderBy(desc(alerts.sentAt)).limit(limit);
}

export async function getUnreadAlertsCount() {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(alerts).where(isNull(alerts.readAt));
  return Number(row?.n ?? 0);
}

export async function getRecentTrades(limit = 500) {
  return db.select().from(trades).orderBy(desc(trades.executedAt)).limit(limit);
}

export async function getRecentErrorLogs(limit = 30) {
  return db.select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(limit);
}

export async function getCapitalHistory(limit = 100) {
  return db.select().from(capitalLedger).orderBy(desc(capitalLedger.changedAt)).limit(limit);
}

export async function getPendingOperations() {
  return db
    .select()
    .from(pendingOperations)
    .where(eq(pendingOperations.status, "aguardando_venda"))
    .orderBy(desc(pendingOperations.startedAt));
}

export async function getPendingOperationById(id: string) {
  const [row] = await db.select().from(pendingOperations).where(eq(pendingOperations.id, id)).limit(1);
  return row ?? null;
}

export async function getRecentFinishedOperations(limit = 20) {
  return db
    .select()
    .from(pendingOperations)
    .where(sql`${pendingOperations.status} != 'aguardando_venda'`)
    .orderBy(desc(pendingOperations.finalizedAt))
    .limit(limit);
}

export type CapitalPosition = {
  /** O que está configurado em /settings. */
  totalMzn: number;
  /** Preso em operações já compradas e ainda por vender. */
  lockedMzn: number;
  /** O que sobra para uma operação nova — é isto que o motor deve usar. */
  availableMzn: number;
  lockedOperations: number;
};

/**
 * O capital não é um número só. Enquanto uma compra está à espera de
 * comprador, esse dinheiro já saiu — está em USDT, não em Meticais — mas o
 * sistema continuava a simular e a alertar como se estivesse todo
 * disponível. Resultado: alertas para operações impossíveis de executar, e
 * um "capital configurado" no cabeçalho que não correspondia à realidade.
 */
export async function getCapitalPosition(): Promise<CapitalPosition> {
  const [config] = await db.select().from(settings).where(eq(settings.id, true)).limit(1);
  const [locked] = await db
    .select({
      lockedMzn: sql<string>`coalesce(sum(${pendingOperations.capitalUsedMzn}), 0)`,
      n: sql<number>`count(*)`,
    })
    .from(pendingOperations)
    .where(eq(pendingOperations.status, "aguardando_venda"));

  const totalMzn = Number(config?.currentCapitalMzn ?? 0);
  const lockedMzn = Number(locked?.lockedMzn ?? 0);

  return {
    totalMzn,
    lockedMzn,
    availableMzn: Math.max(0, totalMzn - lockedMzn),
    lockedOperations: Number(locked?.n ?? 0),
  };
}

export async function getTradeStats() {
  const [row] = await db
    .select({
      totalTrades: sql<number>`count(*)`,
      wins: sql<number>`count(*) filter (where net_profit_mzn > 0)`,
      totalNetProfit: sql<string>`coalesce(sum(net_profit_mzn), 0)`,
      avgNetPct: sql<string>`coalesce(avg(net_profit_mzn / nullif(capital_used_mzn, 0) * 100), 0)`,
    })
    .from(trades);
  return row;
}
