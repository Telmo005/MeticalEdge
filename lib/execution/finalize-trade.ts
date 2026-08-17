import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { alerts, capitalLedger, exchangeBalances, opportunities, trades } from "@/db/schema";
import type { ExchangeId, OrderResult } from "@/lib/exchange/types";
import { sendPush } from "@/lib/messaging-client";
import { logError } from "@/lib/errorLog.core";

const FILL_TOLERANCE = 0.98;

export function feeInUsdt(order: OrderResult, quoteAsset: string): number {
  return order.fills.reduce((sum, fill) => {
    const commission = Number(fill.commission);
    if (!commission) return sum;
    if (fill.commissionAsset === quoteAsset) return sum + commission;
    return sum + commission * Number(fill.price);
  }, 0);
}

export type FinalizeTradeParams = {
  tradeId: string;
  opportunityId: string;
  pair: string;
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  capitalUsdt: number;
  sellQtyTarget: number;
  buyOrder: OrderResult | null;
  sellOrder: OrderResult | null;
  grossSpreadPct: number;
  estimatedSlippagePct: number;
  estimatedNetPct: number;
  fallbackBuyPrice: number;
  fallbackSellPrice: number;
  errorMessage: string | null;
  startedAt: Date;
};

/** Fecha uma linha de `trades` já criada (secção "estado persistente entre
 *  pernas" — nunca faz um INSERT novo, sempre UPDATE) com o resultado real:
 *  contabilidade de taxas/lucro, saldo por exchange, ledger de capital, e
 *  alerta. Partilhado entre o fim normal de `executeArbitrage` e a
 *  reconciliação de trades presas no arranque do worker — as duas situações
 *  só diferem em como obtiveram `buyOrder`/`sellOrder`. */
export async function finalizeTrade(params: FinalizeTradeParams): Promise<{ outcome: "success" | "partial_recovered" | "failed"; profitRealUsdt: number }> {
  const {
    tradeId, opportunityId, pair, buyExchange, sellExchange, capitalUsdt, sellQtyTarget,
    buyOrder, sellOrder, grossSpreadPct, estimatedSlippagePct, estimatedNetPct,
    fallbackBuyPrice, fallbackSellPrice, errorMessage, startedAt,
  } = params;

  const finalBuyComplete = buyOrder !== null && Number(buyOrder.cummulativeQuoteQty) >= capitalUsdt * FILL_TOLERANCE;
  const finalSellComplete = sellOrder !== null && Number(sellOrder.executedQty) >= sellQtyTarget * FILL_TOLERANCE;

  const outcome: "success" | "partial_recovered" | "failed" =
    finalBuyComplete && finalSellComplete
      ? "success"
      : (buyOrder !== null && Number(buyOrder.executedQty) > 0) || (sellOrder !== null && Number(sellOrder.executedQty) > 0)
        ? "partial_recovered"
        : "failed";

  const buyFeeUsdt = buyOrder ? feeInUsdt(buyOrder, "USDT") : 0;
  const sellFeeUsdt = sellOrder ? feeInUsdt(sellOrder, "USDT") : 0;
  const grossBuyCostUsdt = Number(buyOrder?.cummulativeQuoteQty ?? "0");
  const grossSellUsdt = Number(sellOrder?.cummulativeQuoteQty ?? "0");
  const profitRealUsdt = grossSellUsdt - sellFeeUsdt - grossBuyCostUsdt;
  const executionTimeMs = Date.now() - startedAt.getTime();
  const profitTheoreticalUsdt = capitalUsdt * (grossSpreadPct / 100);
  const actualNetPct = capitalUsdt > 0 ? (profitRealUsdt / capitalUsdt) * 100 : 0;

  await db.transaction(async (tx) => {
    await tx.update(trades).set({
      completedAt: new Date(),
      buyOrderId: buyOrder?.orderId ?? null,
      sellOrderId: sellOrder?.orderId ?? null,
      buyPrice: buyOrder && Number(buyOrder.executedQty) > 0 ? String(grossBuyCostUsdt / Number(buyOrder.executedQty)) : String(fallbackBuyPrice),
      sellPrice: sellOrder && Number(sellOrder.executedQty) > 0 ? String(grossSellUsdt / Number(sellOrder.executedQty)) : String(fallbackSellPrice),
      buyFeeUsdt: String(buyFeeUsdt),
      sellFeeUsdt: String(sellFeeUsdt),
      slippageEstimatedPct: String(estimatedSlippagePct),
      slippageRealPct: String(estimatedNetPct - actualNetPct),
      profitTheoreticalUsdt: String(profitTheoreticalUsdt),
      profitRealUsdt: String(profitRealUsdt),
      outcome,
      errorMessage,
      executionTimeMs,
    }).where(eq(trades.id, tradeId));

    await tx.update(opportunities).set({ status: "executed" }).where(eq(opportunities.id, opportunityId));

    // Actualiza o saldo USDT livre de cada exchange a partir do que
    // realmente aconteceu; o valor total de portefólio (activos incluídos)
    // é mantido em dia pela sincronização regular do worker a cada
    // iteração do loop, não por aqui.
    await tx
      .update(exchangeBalances)
      .set({ usdtFree: sql`${exchangeBalances.usdtFree} - ${grossBuyCostUsdt}`, updatedAt: new Date() })
      .where(eq(exchangeBalances.exchangeId, buyExchange));
    await tx
      .update(exchangeBalances)
      .set({ usdtFree: sql`${exchangeBalances.usdtFree} + ${grossSellUsdt - sellFeeUsdt}`, updatedAt: new Date() })
      .where(eq(exchangeBalances.exchangeId, sellExchange));

    const [buyBalanceRow] = await tx.select().from(exchangeBalances).where(eq(exchangeBalances.exchangeId, buyExchange));
    const [sellBalanceRow] = await tx.select().from(exchangeBalances).where(eq(exchangeBalances.exchangeId, sellExchange));

    // Delta de valor de portefólio: o lado da compra só perde o que pagou
    // em taxa (USDT convertido em activo ao preço de mercado é neutro em
    // valor); o lucro realizado em USDT aparece do lado da venda.
    const buyValueDelta = -buyFeeUsdt;
    const sellValueDelta = profitRealUsdt + buyFeeUsdt;

    const newBuyTotal = Number(buyBalanceRow.totalValueUsdt) + buyValueDelta;
    const newSellTotal = Number(sellBalanceRow.totalValueUsdt) + sellValueDelta;

    await tx.update(exchangeBalances).set({ totalValueUsdt: String(newBuyTotal), updatedAt: new Date() }).where(eq(exchangeBalances.exchangeId, buyExchange));
    await tx.update(exchangeBalances).set({ totalValueUsdt: String(newSellTotal), updatedAt: new Date() }).where(eq(exchangeBalances.exchangeId, sellExchange));

    // As duas linhas partilham o mesmo `changedAt` de propósito — o gráfico
    // de capital combinado (getCapitalHistory) soma por timestamp exacto
    // para obter o total das duas exchanges em cada momento.
    const ledgerChangedAt = new Date();
    await tx.insert(capitalLedger).values([
      { changedAt: ledgerChangedAt, exchangeId: buyExchange, deltaUsdt: String(buyValueDelta), reason: `trade_${outcome}`, tradeId, resultingBalanceUsdt: String(newBuyTotal) },
      { changedAt: ledgerChangedAt, exchangeId: sellExchange, deltaUsdt: String(sellValueDelta), reason: `trade_${outcome}`, tradeId, resultingBalanceUsdt: String(newSellTotal) },
    ]);

    await tx.insert(alerts).values({
      kind: outcome === "success" && profitRealUsdt > 0 ? "lucro" : outcome === "failed" ? "erro" : "perda",
      title: outcome === "success" ? `Ciclo concluído: ${pair}` : `Ciclo ${outcome}: ${pair}`,
      body: `${buyExchange} -> ${sellExchange} | lucro real: ${profitRealUsdt.toFixed(4)} USDT (${actualNetPct.toFixed(3)}%)${errorMessage ? ` | ${errorMessage}` : ""}`,
    });
  });

  await sendPush(
    outcome === "success" ? "Arbitragem concluída" : `Arbitragem: ${outcome}`,
    `${pair}: ${buyExchange} -> ${sellExchange}, lucro real ${profitRealUsdt.toFixed(4)} USDT`,
  );

  if (errorMessage) {
    await logError("execution.finalizeTrade", new Error(errorMessage), { pair, buyExchange, sellExchange, outcome, tradeId });
  }

  return { outcome, profitRealUsdt };
}
