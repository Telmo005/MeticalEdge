import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { botHeartbeats, opportunities, tradeEvents, trades } from "@/db/schema";
import type { ExchangeId, ExchangeInfo, OrderResult } from "@/lib/exchange/types";
import { EXCHANGES } from "@/lib/exchange/registry";
import { roundDownToStep, stepSizeOf } from "@/lib/exchange/symbol-filters";
import { evaluateOpportunity, type OpportunityEvaluation } from "@/lib/arbitrage/opportunity-engine";
import { recoverLeg } from "@/lib/execution/recovery";
import { finalizeTrade } from "@/lib/execution/finalize-trade";
import { engageKillSwitch } from "@/lib/kill-switch.core";

export type ExecutionResult =
  | { executed: true; tradeId: string; outcome: "success" | "partial_recovered" | "failed"; profitRealUsdt: number }
  | { executed: false; reason: string };

const FILL_TOLERANCE = 0.98;

function baseAssetOf(pair: string): string {
  return pair.endsWith("USDT") ? pair.slice(0, -4) : pair;
}

function mergeOrders(first: OrderResult | null, second: OrderResult | null): OrderResult {
  const orders = [first, second].filter((o): o is OrderResult => o !== null);
  return {
    orderId: orders[0]?.orderId ?? "",
    status: orders.some((o) => o.status === "FILLED") || orders.length > 1 ? "FILLED" : (orders[0]?.status ?? "FAILED"),
    executedQty: String(orders.reduce((sum, o) => sum + Number(o.executedQty), 0)),
    cummulativeQuoteQty: String(orders.reduce((sum, o) => sum + Number(o.cummulativeQuoteQty), 0)),
    fills: orders.flatMap((o) => o.fills),
  };
}

/** Curto o suficiente para caber nos limites de `newClientOrderId`
 *  (Binance) / `orderLinkId` (Bybit), só alfanumérico. */
function shortId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

async function writeHeartbeat(status: string, detail: string | null) {
  await db
    .update(botHeartbeats)
    .set({ status: status as never, statusDetail: detail, updatedAt: new Date() })
    .where(eq(botHeartbeats.id, true));
}

/** Executa uma oportunidade de arbitragem cross-exchange (secções 8-11):
 *  reconfirma tudo em cima de dados frescos, dispara as duas pernas quase em
 *  simultâneo, e usa o Recovery Engine no máximo uma vez por perna se algo
 *  não preencher como esperado.
 *
 *  Estado persistente entre pernas (roteiro P0): a linha em `trades` é
 *  criada *antes* de disparar qualquer ordem (`outcome: "in_progress"`) —
 *  se o processo morrer a meio, essa linha fica para
 *  `reconcilePendingTrades()` (chamada no arranque do worker) encontrar e
 *  fechar com o resultado real, nunca perdida nem duplicada. */
export async function executeArbitrage(params: {
  opportunity: OpportunityEvaluation;
  opportunityId: string;
  buyFeePct: number;
  sellFeePct: number;
  minProfitPct: number;
  minSafetyMarginPct: number;
  maxExecutionTimeMs: number;
  maxTradeLossUsdt: number;
  maxConsecutiveLosses: number;
  exchangeInfo: Record<ExchangeId, ExchangeInfo>;
}): Promise<ExecutionResult> {
  const {
    opportunity, opportunityId, buyFeePct, sellFeePct, minProfitPct, minSafetyMarginPct,
    maxExecutionTimeMs, maxTradeLossUsdt, maxConsecutiveLosses, exchangeInfo,
  } = params;
  const { pair, buyExchange, sellExchange, capitalUsdt } = opportunity;
  const buyAdapter = EXCHANGES[buyExchange];
  const sellAdapter = EXCHANGES[sellExchange];
  const baseAsset = baseAssetOf(pair);
  const startedAt = new Date();

  if (!buyAdapter.hasCredentials() || !sellAdapter.hasCredentials()) {
    return { executed: false, reason: "faltam credenciais API numa das exchanges" };
  }

  // Reconfirma preço, liquidez, inventário e margem em cima de dados
  // frescos, imediatamente antes de agir — a oportunidade recebida pode já
  // ter alguns segundos.
  const [buyBook, sellBook, buyBalances, sellBalances] = await Promise.all([
    buyAdapter.getOrderBookDepth(pair, 100),
    sellAdapter.getOrderBookDepth(pair, 100),
    buyAdapter.getAccountBalances(),
    sellAdapter.getAccountBalances(),
  ]);

  const buyUsdtFree = Number(buyBalances.find((b) => b.asset === "USDT")?.free ?? "0");
  const sellAssetAvailable = Number(sellBalances.find((b) => b.asset === baseAsset)?.free ?? "0");

  if (buyUsdtFree < capitalUsdt) {
    await db.update(opportunities).set({ status: "rejected" }).where(eq(opportunities.id, opportunityId));
    return { executed: false, reason: `saldo USDT insuficiente em ${buyExchange} para o capital previsto` };
  }

  const fresh = evaluateOpportunity({
    pair, buyExchange, sellExchange, capitalUsdt, buyBook, sellBook,
    buyFeePct, sellFeePct, sellExchangeAssetAvailable: sellAssetAvailable, minProfitPct, minSafetyMarginPct,
  });

  if (!fresh.passedFilters) {
    await db.update(opportunities).set({ status: "rejected" }).where(eq(opportunities.id, opportunityId));
    return { executed: false, reason: `deixou de ser válida ao reavaliar: ${fresh.rejectReasons.join("; ")}` };
  }

  const sellStep = stepSizeOf(exchangeInfo[sellExchange], pair);
  const sellQty = roundDownToStep(fresh.quantity, sellStep);
  if (sellQty <= 0) {
    await db.update(opportunities).set({ status: "rejected" }).where(eq(opportunities.id, opportunityId));
    return { executed: false, reason: "quantidade de venda arredondada a zero pelo tamanho mínimo do lote" };
  }

  const buyClientOrderId = `me${shortId()}b`;
  const sellClientOrderId = `me${shortId()}s`;
  const buyRetryClientOrderId = `me${shortId()}br`;
  const sellRetryClientOrderId = `me${shortId()}sr`;

  const [inserted] = await db
    .insert(trades)
    .values({
      opportunityId,
      startedAt,
      pair,
      buyExchange,
      sellExchange,
      buyClientOrderId,
      sellClientOrderId,
      quantity: String(sellQty),
      capitalUsdt: String(capitalUsdt),
      profitTheoreticalUsdt: String(capitalUsdt * (fresh.grossSpreadPct / 100)),
      profitEstimatedUsdt: String(fresh.netResultUsdt),
      outcome: "in_progress",
    })
    .returning({ id: trades.id });
  const tradeId = inserted.id;

  async function logEvent(event: string, detail: string | null = null) {
    await db.insert(tradeEvents).values({ tradeId, event, detail });
  }
  await logEvent("opportunity_validated", `net ${fresh.netPct.toFixed(3)}% sobre ${capitalUsdt.toFixed(4)} USDT`);

  await writeHeartbeat("executing", `${pair}: comprar ${buyExchange} / vender ${sellExchange}`);
  const deadline = Date.now() + maxExecutionTimeMs;

  // Dispara as duas pernas quase em simultâneo — não espera uma confirmar
  // antes de enviar a outra (secção 8).
  await logEvent("buy_order_sent", `${buyExchange} ${pair} quoteOrderQty=${capitalUsdt.toFixed(8)} clientOrderId=${buyClientOrderId}`);
  await logEvent("sell_order_sent", `${sellExchange} ${pair} quantity=${sellQty.toFixed(8)} clientOrderId=${sellClientOrderId}`);
  const [buySettled, sellSettled] = await Promise.allSettled([
    buyAdapter.placeMarketOrder({ symbol: pair, side: "BUY", quoteOrderQty: capitalUsdt.toFixed(8), clientOrderId: buyClientOrderId }),
    sellAdapter.placeMarketOrder({ symbol: pair, side: "SELL", quantity: sellQty.toFixed(8), clientOrderId: sellClientOrderId }),
  ]);

  let buyOrder = buySettled.status === "fulfilled" ? buySettled.value : null;
  let sellOrder = sellSettled.status === "fulfilled" ? sellSettled.value : null;
  const legErrors: string[] = [];
  if (buySettled.status === "rejected") {
    legErrors.push(`compra: ${String(buySettled.reason)}`);
    await logEvent("buy_order_failed", String(buySettled.reason));
  } else {
    await logEvent("buy_order_result", `status=${buyOrder!.status} executedQty=${buyOrder!.executedQty}`);
  }
  if (sellSettled.status === "rejected") {
    legErrors.push(`venda: ${String(sellSettled.reason)}`);
    await logEvent("sell_order_failed", String(sellSettled.reason));
  } else {
    await logEvent("sell_order_result", `status=${sellOrder!.status} executedQty=${sellOrder!.executedQty}`);
  }

  const buyComplete = buyOrder !== null && Number(buyOrder.cummulativeQuoteQty) >= capitalUsdt * FILL_TOLERANCE;
  const sellComplete = sellOrder !== null && Number(sellOrder.executedQty) >= sellQty * FILL_TOLERANCE;

  if (!buyComplete) {
    await logEvent("recovery_started", `perna de compra incompleta em ${buyExchange}`);
    await writeHeartbeat("recovery", `${pair}: perna de compra incompleta em ${buyExchange}, a tentar recuperar`);
    const remainingQuoteUsdt = capitalUsdt - Number(buyOrder?.cummulativeQuoteQty ?? "0");
    const retry = await recoverLeg({
      exchange: buyAdapter, pair, side: "BUY",
      originalClientOrderId: buyClientOrderId, retryClientOrderId: buyRetryClientOrderId,
      remainingQuoteUsdt, deadline,
    });
    if (retry.orderResult) {
      buyOrder = retry.recoveredViaLookup ? retry.orderResult : mergeOrders(buyOrder, retry.orderResult);
      await logEvent(retry.recoveredViaLookup ? "recovery_found_existing" : "recovery_completed", `compra: +${retry.orderResult.executedQty}`);
    } else if (retry.error) {
      legErrors.push(`recuperação compra: ${retry.error}`);
      await logEvent("recovery_failed", `compra: ${retry.error}`);
    }
  }

  if (!sellComplete) {
    await logEvent("recovery_started", `perna de venda incompleta em ${sellExchange}`);
    await writeHeartbeat("recovery", `${pair}: perna de venda incompleta em ${sellExchange}, a tentar recuperar`);
    const remainingQuantity = sellQty - Number(sellOrder?.executedQty ?? "0");
    const retry = await recoverLeg({
      exchange: sellAdapter, pair, side: "SELL",
      originalClientOrderId: sellClientOrderId, retryClientOrderId: sellRetryClientOrderId,
      remainingQuantity, deadline,
    });
    if (retry.orderResult) {
      sellOrder = retry.recoveredViaLookup ? retry.orderResult : mergeOrders(sellOrder, retry.orderResult);
      await logEvent(retry.recoveredViaLookup ? "recovery_found_existing" : "recovery_completed", `venda: +${retry.orderResult.executedQty}`);
    } else if (retry.error) {
      legErrors.push(`recuperação venda: ${retry.error}`);
      await logEvent("recovery_failed", `venda: ${retry.error}`);
    }
  }

  const errorMessage = legErrors.length > 0 ? legErrors.join(" | ") : null;
  await logEvent("finalizing", errorMessage ?? undefined);

  const { outcome, profitRealUsdt } = await finalizeTrade({
    tradeId, opportunityId, pair, buyExchange, sellExchange, capitalUsdt,
    sellQtyTarget: sellQty, buyOrder, sellOrder,
    grossSpreadPct: fresh.grossSpreadPct,
    estimatedSlippagePct: fresh.estimatedSlippagePct,
    estimatedNetPct: fresh.netPct,
    fallbackBuyPrice: fresh.buyPrice,
    fallbackSellPrice: fresh.sellPrice,
    errorMessage,
    startedAt,
  });

  // Perda máxima por operação e perdas consecutivas (roteiro P0) — só
  // trades reais, nunca paper. O limite diário agregado já existe à parte
  // (worker/index.ts); isto protege contra uma única operação muito má.
  if (profitRealUsdt < -maxTradeLossUsdt) {
    await engageKillSwitch(`perda de ${Math.abs(profitRealUsdt).toFixed(4)} USDT numa única operação (${pair}) excedeu o limite de ${maxTradeLossUsdt.toFixed(4)} USDT`);
  } else {
    const [heartbeat] = await db.select().from(botHeartbeats).where(eq(botHeartbeats.id, true)).limit(1);
    const consecutiveLosses = profitRealUsdt <= 0 ? (heartbeat?.consecutiveLosses ?? 0) + 1 : 0;
    await db.update(botHeartbeats).set({ consecutiveLosses }).where(eq(botHeartbeats.id, true));
    if (consecutiveLosses >= maxConsecutiveLosses) {
      await engageKillSwitch(`${consecutiveLosses} operações reais seguidas sem lucro`);
    }
  }

  await writeHeartbeat("scanning", null);
  return { executed: true, tradeId, outcome, profitRealUsdt };
}

/** No arranque do worker: fecha qualquer `trades` com `outcome = "in_progress"`
 *  deixada por um processo anterior que morreu a meio de uma execução —
 *  consulta as duas exchanges pelos `clientOrderId` persistidos (nunca
 *  reenvia nada) e regista o que realmente aconteceu. */
export async function reconcilePendingTrades(): Promise<number> {
  const pending = await db.select().from(trades).where(eq(trades.outcome, "in_progress"));
  for (const trade of pending) {
    const buyAdapter = EXCHANGES[trade.buyExchange];
    const sellAdapter = EXCHANGES[trade.sellExchange];

    const [buyOrder, sellOrder] = await Promise.all([
      trade.buyClientOrderId ? buyAdapter.getOrderByClientId(trade.pair, trade.buyClientOrderId).catch(() => null) : Promise.resolve(null),
      trade.sellClientOrderId ? sellAdapter.getOrderByClientId(trade.pair, trade.sellClientOrderId).catch(() => null) : Promise.resolve(null),
    ]);

    await db.insert(tradeEvents).values({
      tradeId: trade.id,
      event: "reconciled_after_restart",
      detail: `buy=${buyOrder ? buyOrder.status : "não encontrada"} sell=${sellOrder ? sellOrder.status : "não encontrada"}`,
    });

    await finalizeTrade({
      tradeId: trade.id,
      opportunityId: trade.opportunityId ?? "",
      pair: trade.pair,
      buyExchange: trade.buyExchange,
      sellExchange: trade.sellExchange,
      capitalUsdt: Number(trade.capitalUsdt),
      sellQtyTarget: Number(trade.quantity),
      buyOrder,
      sellOrder,
      grossSpreadPct: 0,
      estimatedSlippagePct: 0,
      estimatedNetPct: 0,
      fallbackBuyPrice: 0,
      fallbackSellPrice: 0,
      errorMessage: "reconciliado após reinício do worker — ver trade_events",
      startedAt: trade.startedAt,
    });
  }
  return pending.length;
}
