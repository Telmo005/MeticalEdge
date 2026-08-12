import "server-only";
import { desc, eq, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { settings, snapshots, opportunities, trades, alerts, capitalLedger, errorLogs } from "@/db/schema";

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
