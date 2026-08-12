import "server-only";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { snapshots } from "@/db/schema";

const PRICE_EPSILON = 0.01;
const STALE_MIN_STREAK_MINUTES = 15;
const STALE_REFERENCE_MOVE_PCT = 0.3;

type BestAdSample = {
  collectedAt: Date;
  advNo: string | null;
  price: number | null;
  referenceUsdMzn: number | null;
};

/**
 * Vai buscar só o topo do livro (elemento [0] do array já ordenado no
 * snapshot) de cada uma das últimas `limit` varreduras — muito mais barato
 * do que reconstruir o livro inteiro histórico, e é tudo o que os motores
 * de "anúncio parado" / "anúncio novo" precisam.
 */
async function getBestAdHistory(side: "ask" | "bid", limit: number): Promise<BestAdSample[]> {
  const column = side === "ask" ? snapshots.askAds : snapshots.bidAds;
  const rows = await db
    .select({
      collectedAt: snapshots.collectedAt,
      advNo: sql<string | null>`${column}->0->>'advNo'`,
      price: sql<string | null>`${column}->0->>'price'`,
      referenceUsdMzn: snapshots.referenceUsdMzn,
    })
    .from(snapshots)
    .orderBy(desc(snapshots.collectedAt))
    .limit(limit);

  return rows.map((r) => ({
    collectedAt: r.collectedAt,
    advNo: r.advNo,
    price: r.price === null ? null : Number(r.price),
    referenceUsdMzn: r.referenceUsdMzn === null ? null : Number(r.referenceUsdMzn),
  }));
}

export type TopAdLifecycleSignal =
  | { kind: "none" }
  | { kind: "steady" }
  | { kind: "new"; advNo: string; price: number; previousPrice: number | null }
  | { kind: "stale"; advNo: string; price: number; streakMinutes: number; referenceMovePct: number };

/**
 * Lê o "ciclo de vida" da melhor oferta de um lado do livro comparando a
 * varredura actual com as anteriores (uma por minuto, já gravadas pelo
 * cron):
 *
 * - "new": o primeiro lugar mudou de anúncio nesta varredura E o preço
 *   melhorou — corrida a um preço que acabou de aparecer, vale a pena agir
 *   depressa porque tende a durar pouco.
 * - "stale": o mesmo anúncio, ao mesmo preço, está em primeiro lugar há
 *   pelo menos `STALE_MIN_STREAK_MINUTES` minutos, enquanto o preço de
 *   referência da Binance (independente do livro P2P) já se moveu — sinal
 *   de que o comerciante provavelmente esqueceu-se do anúncio, não que o
 *   preço é bom por estratégia.
 * - "steady": nada de especial — o preço está normal e estável.
 */
export async function analyzeTopAdLifecycle(
  side: "ask" | "bid",
  windowMinutes = 30
): Promise<TopAdLifecycleSignal> {
  const history = await getBestAdHistory(side, windowMinutes);
  const current = history[0];
  if (!current || current.advNo === null || current.price === null) {
    return { kind: "none" };
  }

  const previous = history[1];
  if (previous && previous.advNo !== null && previous.price !== null && previous.advNo !== current.advNo) {
    const improved =
      side === "ask" ? current.price < previous.price - PRICE_EPSILON : current.price > previous.price + PRICE_EPSILON;
    if (improved) {
      return { kind: "new", advNo: current.advNo, price: current.price, previousPrice: previous.price };
    }
  }

  let streak = 1;
  while (
    streak < history.length &&
    history[streak].advNo === current.advNo &&
    history[streak].price !== null &&
    Math.abs((history[streak].price as number) - current.price) <= PRICE_EPSILON
  ) {
    streak++;
  }

  if (streak >= STALE_MIN_STREAK_MINUTES) {
    const oldest = history[streak - 1];
    if (oldest.referenceUsdMzn !== null && current.referenceUsdMzn !== null && oldest.referenceUsdMzn > 0) {
      const referenceMovePct = ((current.referenceUsdMzn - oldest.referenceUsdMzn) / oldest.referenceUsdMzn) * 100;
      if (Math.abs(referenceMovePct) >= STALE_REFERENCE_MOVE_PCT) {
        return { kind: "stale", advNo: current.advNo, price: current.price, streakMinutes: streak, referenceMovePct };
      }
    }
  }

  return { kind: "steady" };
}
