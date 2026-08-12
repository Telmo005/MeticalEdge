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
