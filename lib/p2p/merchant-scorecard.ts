import "server-only";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { trades, opportunities } from "@/db/schema";

export type MerchantScoreRow = {
  merchantId: string;
  merchantName: string;
  tradesInvolved: number;
  avgNetProfitMzn: number;
  successRate: number;
};

/**
 * Módulo à parte da varredura em tempo real: em vez de olhar para o
 * mercado, olha para o que TU já viveste. A nota de reputação da Binance
 * (taxa de conclusão, ordens/mês) é a opinião deles sobre o comerciante —
 * isto é a tua própria experiência, construída a partir de cada operação
 * que reportaste em /trades. É o único dos quatro motores que realmente
 * aprende contigo em vez de só ler o livro de ofertas.
 *
 * Atribui o resultado líquido de cada operação reportada a TODOS os
 * comerciantes envolvidos nela (lado de compra e de venda) — é uma
 * aproximação simples, não reparte o crédito entre pernas, mas é honesta:
 * mostra com quem as tuas operações, no total, têm corrido bem ou mal.
 */
export async function getPersonalMerchantScorecard(): Promise<MerchantScoreRow[]> {
  const rows = await db
    .select({
      netProfitMzn: trades.netProfitMzn,
      outcome: trades.outcome,
      detail: opportunities.detail,
    })
    .from(trades)
    .innerJoin(opportunities, eq(trades.opportunityId, opportunities.id))
    .where(isNotNull(trades.opportunityId));

  const byMerchant = new Map<
    string,
    { merchantName: string; netSum: number; successes: number; total: number }
  >();

  for (const row of rows) {
    const netProfitMzn = Number(row.netProfitMzn);
    const steps = [...(row.detail?.buySteps ?? []), ...(row.detail?.sellSteps ?? [])];
    const merchantsInThisTrade = new Map<string, string>();
    for (const step of steps) {
      if (step.merchantId) merchantsInThisTrade.set(step.merchantId, step.merchantName);
    }

    for (const [merchantId, merchantName] of merchantsInThisTrade) {
      const entry = byMerchant.get(merchantId) ?? { merchantName, netSum: 0, successes: 0, total: 0 };
      entry.netSum += netProfitMzn;
      entry.total += 1;
      if (row.outcome === "success") entry.successes += 1;
      byMerchant.set(merchantId, entry);
    }
  }

  return Array.from(byMerchant.entries())
    .map(([merchantId, v]) => ({
      merchantId,
      merchantName: v.merchantName,
      tradesInvolved: v.total,
      avgNetProfitMzn: v.netSum / v.total,
      successRate: v.successes / v.total,
    }))
    .sort((a, b) => b.tradesInvolved - a.tradesInvolved || b.avgNetProfitMzn - a.avgNetProfitMzn);
}
