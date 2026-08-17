import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exchangeHealth, type ExchangeId } from "@/db/schema";

/** Envolve uma chamada a um adaptador de exchange, medindo latência e
 *  actualizando `exchange_health` — usado pelo worker em cada chamada de
 *  mercado/saldo, para o painel mostrar a saúde da ligação sem ir aos
 *  logs. Nunca engole o erro: relança depois de registar. */
export async function withHealthTracking<T>(exchangeId: ExchangeId, fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - startedAt;
    await db
      .update(exchangeHealth)
      .set({
        lastSuccessAt: new Date(),
        avgLatencyMs: latencyMs,
        updatedAt: new Date(),
      })
      .where(eq(exchangeHealth.exchangeId, exchangeId));
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(exchangeHealth)
      .set({
        lastErrorAt: new Date(),
        lastErrorMessage: message.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(exchangeHealth.exchangeId, exchangeId));
    throw err;
  }
}
