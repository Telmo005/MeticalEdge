import "server-only";
import { gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { snapshots } from "@/db/schema";

export type PriceExtremes = {
  windowDays: number;
  /** Preço mais baixo visto para comprar USDT (bestAsk) na janela. */
  minAsk: number | null;
  /** Preço mais alto visto para vender USDT (bestBid) na janela. */
  maxBid: number | null;
  sampleCount: number;
};

/**
 * "Memória de preços" simples e honesta: não é machine learning, é olhar
 * para o histórico de varreduras já guardado (uma por minuto, via cron) e
 * perguntar "isto já esteve tão bom como agora, nos últimos N dias?". É a
 * base para avisar "está no preço mais baixo para comprar" / "está no preço
 * mais alto para vender" sem o utilizador ter de olhar para gráfico nenhum.
 */
export async function getPriceExtremes(windowDays = 7): Promise<PriceExtremes> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({
      minAsk: sql<string | null>`min(${snapshots.bestAsk})`,
      maxBid: sql<string | null>`max(${snapshots.bestBid})`,
      sampleCount: sql<number>`count(*)`,
    })
    .from(snapshots)
    .where(gte(snapshots.collectedAt, since));

  return {
    windowDays,
    minAsk: row?.minAsk == null ? null : Number(row.minAsk),
    maxBid: row?.maxBid == null ? null : Number(row.maxBid),
    sampleCount: Number(row?.sampleCount ?? 0),
  };
}

export type ReferenceDivergenceSignal = {
  windowDays: number;
  sampleCount: number;
  /** Quanto o melhor preço de compra está acima do preço de referência da
   *  Binance (spot), em %. Positivo = pagas um prémio sobre a referência. */
  currentAskPremiumPct: number | null;
  /** Quantos desvios-padrão esse prémio está da média dos últimos dias. */
  askPremiumZScore: number | null;
  /** Quanto o melhor preço de venda está abaixo da referência, em %.
   *  Positivo = vendes com desconto sobre a referência. */
  currentBidDiscountPct: number | null;
  bidDiscountZScore: number | null;
};

/**
 * Compara o preço P2P de agora com o preço de referência da Binance (spot),
 * mas não com um limiar fixo inventado — com a distribuição real desse
 * mesmo desvio nos últimos `windowDays` dias. Um desvio de 2 desvios-padrão
 * é estatisticamente incomum PARA ESTE MERCADO, seja qual for o número
 * absoluto — nunca inventamos "3% é muito", deixamos os próprios dados
 * dizerem o que é normal aqui.
 */
export async function getReferenceDivergenceSignal(
  currentBestAsk: number | null,
  currentBestBid: number | null,
  currentReferenceUsdMzn: number | null,
  windowDays = 7
): Promise<ReferenceDivergenceSignal> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [stats] = await db
    .select({
      avgAskPremium: sql<string | null>`avg((${snapshots.bestAsk} - ${snapshots.referenceUsdMzn}) / nullif(${snapshots.referenceUsdMzn}, 0) * 100)`,
      stdAskPremium: sql<string | null>`stddev_samp((${snapshots.bestAsk} - ${snapshots.referenceUsdMzn}) / nullif(${snapshots.referenceUsdMzn}, 0) * 100)`,
      avgBidDiscount: sql<string | null>`avg((${snapshots.referenceUsdMzn} - ${snapshots.bestBid}) / nullif(${snapshots.referenceUsdMzn}, 0) * 100)`,
      stdBidDiscount: sql<string | null>`stddev_samp((${snapshots.referenceUsdMzn} - ${snapshots.bestBid}) / nullif(${snapshots.referenceUsdMzn}, 0) * 100)`,
      sampleCount: sql<number>`count(*) filter (where ${snapshots.referenceUsdMzn} is not null and ${snapshots.referenceUsdMzn} > 0)`,
    })
    .from(snapshots)
    .where(gte(snapshots.collectedAt, since));

  const currentAskPremiumPct =
    currentBestAsk !== null && currentReferenceUsdMzn
      ? ((currentBestAsk - currentReferenceUsdMzn) / currentReferenceUsdMzn) * 100
      : null;
  const currentBidDiscountPct =
    currentBestBid !== null && currentReferenceUsdMzn
      ? ((currentReferenceUsdMzn - currentBestBid) / currentReferenceUsdMzn) * 100
      : null;

  function zScore(current: number | null, avg: string | null, std: string | null): number | null {
    if (current === null || avg === null || std === null) return null;
    const stdNum = Number(std);
    if (!Number.isFinite(stdNum) || stdNum <= 0) return null;
    return (current - Number(avg)) / stdNum;
  }

  return {
    windowDays,
    sampleCount: Number(stats?.sampleCount ?? 0),
    currentAskPremiumPct,
    askPremiumZScore: zScore(currentAskPremiumPct, stats?.avgAskPremium ?? null, stats?.stdAskPremium ?? null),
    currentBidDiscountPct,
    bidDiscountZScore: zScore(currentBidDiscountPct, stats?.avgBidDiscount ?? null, stats?.stdBidDiscount ?? null),
  };
}
