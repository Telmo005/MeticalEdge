import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, botHeartbeats, capitalLedger, opportunities, paperBalances, tradeEvents, trades } from "@/db/schema";
import { EXCHANGES } from "@/lib/exchange/registry";
import { evaluateOpportunity, type OpportunityEvaluation } from "@/lib/arbitrage/opportunity-engine";
import { sendPush } from "@/lib/messaging-client";

export type SimulationResult =
  | { executed: true; tradeId: string; outcome: "success"; profitRealUsdt: number }
  | { executed: false; reason: string };

async function writeHeartbeat(status: string, detail: string | null) {
  await db
    .update(botHeartbeats)
    .set({ status: status as never, statusDetail: detail, updatedAt: new Date() })
    .where(eq(botHeartbeats.id, true));
}

/** Simula uma oportunidade de arbitragem com dados de mercado 100% reais
 *  (o livro de ordens é público, não precisa de chaves API), mas nunca
 *  envia nenhuma ordem — assume preenchimento total ao preço médio que a
 *  reavaliação fresca calculou. `paper_balances` é um universo de capital
 *  completamente separado de `exchange_balances`, nunca lido/escrito pelo
 *  executor real (`lib/execution/executor.ts`). */
export async function simulateArbitrage(params: {
  opportunity: OpportunityEvaluation;
  opportunityId: string;
  buyFeePct: number;
  sellFeePct: number;
  minProfitPct: number;
  minSafetyMarginPct: number;
}): Promise<SimulationResult> {
  const { opportunity, opportunityId, buyFeePct, sellFeePct, minProfitPct, minSafetyMarginPct } = params;
  const { pair, buyExchange, sellExchange, capitalUsdt } = opportunity;
  const buyAdapter = EXCHANGES[buyExchange];
  const sellAdapter = EXCHANGES[sellExchange];
  const startedAt = new Date();
  const events: { at: Date; event: string; detail: string | null }[] = [];
  const logEvent = (event: string, detail: string | null = null) => events.push({ at: new Date(), event, detail });

  const [buyBook, sellBook] = await Promise.all([
    buyAdapter.getOrderBookDepth(pair, 100),
    sellAdapter.getOrderBookDepth(pair, 100),
  ]);

  const [buyPaperBalance] = await db.select().from(paperBalances).where(eq(paperBalances.exchangeId, buyExchange));
  const [sellPaperBalance] = await db.select().from(paperBalances).where(eq(paperBalances.exchangeId, sellExchange));

  const buyUsdtFree = Number(buyPaperBalance.usdtFree);
  if (buyUsdtFree < capitalUsdt) {
    await db.update(opportunities).set({ status: "rejected" }).where(eq(opportunities.id, opportunityId));
    return { executed: false, reason: `saldo simulado USDT insuficiente em ${buyExchange}` };
  }

  // paper_balances não guarda o detalhe por activo (só usdtFree/total) —
  // aproxima o inventário do activo a vender como "tudo o que não é USDT",
  // convertido a quantidade pelo melhor preço de venda actual.
  const bestSellPrice = Number(sellBook.bids[0]?.[0] ?? 0);
  const sellAssetValueUsdt = Math.max(0, Number(sellPaperBalance.totalValueUsdt) - Number(sellPaperBalance.usdtFree));
  const sellExchangeAssetAvailable = bestSellPrice > 0 ? sellAssetValueUsdt / bestSellPrice : 0;

  const fresh = evaluateOpportunity({
    pair, buyExchange, sellExchange, capitalUsdt, buyBook, sellBook,
    buyFeePct, sellFeePct, sellExchangeAssetAvailable, minProfitPct, minSafetyMarginPct,
  });

  if (!fresh.passedFilters) {
    await db.update(opportunities).set({ status: "rejected" }).where(eq(opportunities.id, opportunityId));
    return { executed: false, reason: `deixou de ser válida ao reavaliar (simulação): ${fresh.rejectReasons.join("; ")}` };
  }
  logEvent("opportunity_validated", `[paper] net ${fresh.netPct.toFixed(3)}% sobre ${capitalUsdt.toFixed(4)} USDT`);

  await writeHeartbeat("executing", `[Paper] ${pair}: comprar ${buyExchange} / vender ${sellExchange}`);

  logEvent("buy_order_simulated", `${buyExchange} ${pair} preço médio ${fresh.buyPrice.toFixed(8)}`);
  logEvent("sell_order_simulated", `${sellExchange} ${pair} preço médio ${fresh.sellPrice.toFixed(8)}`);

  // Custo de compra = capital gasto; taxa aproximada em USDT equivalente
  // (a taxa real é cobrada no activo recebido, mas para efeitos de
  // contabilidade simulada expressamo-la em USDT, tal como o executor real
  // faz para exibição).
  const grossBuyCostUsdt = capitalUsdt;
  const buyFeeUsdt = capitalUsdt * (buyFeePct / 100);
  const grossSellUsdt = fresh.quantity * fresh.sellPrice;
  const sellFeeUsdt = grossSellUsdt * (sellFeePct / 100);
  const profitRealUsdt = fresh.netResultUsdt;
  const profitTheoreticalUsdt = capitalUsdt * (fresh.grossSpreadPct / 100);
  const executionTimeMs = Date.now() - startedAt.getTime();
  logEvent("trade_completed", `[paper] outcome=success profitReal=${profitRealUsdt.toFixed(4)}`);

  let tradeId = "";
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(trades)
      .values({
        opportunityId,
        startedAt,
        completedAt: new Date(),
        pair,
        buyExchange,
        sellExchange,
        buyOrderId: null,
        sellOrderId: null,
        buyPrice: String(fresh.buyPrice),
        sellPrice: String(fresh.sellPrice),
        quantity: String(fresh.quantity),
        capitalUsdt: String(capitalUsdt),
        buyFeeUsdt: String(buyFeeUsdt),
        sellFeeUsdt: String(sellFeeUsdt),
        slippageEstimatedPct: String(fresh.estimatedSlippagePct),
        slippageRealPct: String(fresh.netPct - (opportunity.netPct ?? fresh.netPct)),
        profitTheoreticalUsdt: String(profitTheoreticalUsdt),
        profitEstimatedUsdt: String(opportunity.netResultUsdt),
        profitRealUsdt: String(profitRealUsdt),
        outcome: "success",
        errorMessage: null,
        executionTimeMs,
        isPaper: true,
      })
      .returning();
    tradeId = inserted.id;

    await tx.insert(tradeEvents).values(events.map((e) => ({ tradeId, at: e.at, event: e.event, detail: e.detail })));
    await tx.update(opportunities).set({ status: "executed" }).where(eq(opportunities.id, opportunityId));

    const buyValueDelta = -buyFeeUsdt;
    const sellValueDelta = profitRealUsdt + buyFeeUsdt;
    const newBuyUsdtFree = Number(buyPaperBalance.usdtFree) - grossBuyCostUsdt;
    const newSellUsdtFree = Number(sellPaperBalance.usdtFree) + grossSellUsdt - sellFeeUsdt;
    const newBuyTotal = Number(buyPaperBalance.totalValueUsdt) + buyValueDelta;
    const newSellTotal = Number(sellPaperBalance.totalValueUsdt) + sellValueDelta;

    await tx.update(paperBalances).set({ usdtFree: String(newBuyUsdtFree), totalValueUsdt: String(newBuyTotal), updatedAt: new Date() }).where(eq(paperBalances.exchangeId, buyExchange));
    await tx.update(paperBalances).set({ usdtFree: String(newSellUsdtFree), totalValueUsdt: String(newSellTotal), updatedAt: new Date() }).where(eq(paperBalances.exchangeId, sellExchange));

    const ledgerChangedAt = new Date();
    await tx.insert(capitalLedger).values([
      { changedAt: ledgerChangedAt, exchangeId: buyExchange, deltaUsdt: String(buyValueDelta), reason: "paper_trade_success", tradeId, resultingBalanceUsdt: String(newBuyTotal), isPaper: true },
      { changedAt: ledgerChangedAt, exchangeId: sellExchange, deltaUsdt: String(sellValueDelta), reason: "paper_trade_success", tradeId, resultingBalanceUsdt: String(newSellTotal), isPaper: true },
    ]);

    await tx.insert(alerts).values({
      kind: profitRealUsdt > 0 ? "lucro" : "perda",
      title: `[Paper] Ciclo simulado: ${pair}`,
      body: `${buyExchange} -> ${sellExchange} | lucro simulado: ${profitRealUsdt.toFixed(4)} USDT (${fresh.netPct.toFixed(3)}%)`,
    });
  });

  await sendPush("[Paper] Arbitragem simulada", `${pair}: ${buyExchange} -> ${sellExchange}, lucro simulado ${profitRealUsdt.toFixed(4)} USDT`);
  await writeHeartbeat("scanning", null);

  return { executed: true, tradeId, outcome: "success", profitRealUsdt };
}
