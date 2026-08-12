/**
 * Motor de análise: liga order book + custos + regras de entrada para
 * decidir se, AGORA, com O CAPITAL CONFIGURADO, existe uma oportunidade real
 * de captura de spread cruzado — a mesma estratégia (e as mesmas regras
 * objectivas de entrada/saída) descritas no relatório original
 * (Secção 10 / "Condições objetivas").
 */
import { ALL_SCENARIOS, CostScenario } from "./fees";
import { Ad, ExecutionResult, simulateBuyUsdt, simulateSellUsdt } from "./orderbook";

export type MarketSummary = {
  bestAsk: number | null;
  bestBid: number | null;
  midPrice: number | null;
  spreadPct: number | null;
  isCrossed: boolean;
  nAdsAsk: number;
  nAdsBid: number;
  liquidityAskUsdt: number;
  liquidityBidUsdt: number;
};

export function marketSummary(askAds: Ad[], bidAds: Ad[]): MarketSummary {
  const asks = askAds.filter((a) => a.side === "SELL" && a.price > 0).sort((a, b) => a.price - b.price);
  const bids = bidAds.filter((a) => a.side === "BUY" && a.price > 0).sort((a, b) => b.price - a.price);
  const bestAsk = asks[0]?.price ?? null;
  const bestBid = bids[0]?.price ?? null;
  const isCrossed = !!(bestAsk && bestBid && bestBid > bestAsk);
  return {
    bestAsk,
    bestBid,
    midPrice: bestAsk && bestBid ? (bestAsk + bestBid) / 2 : null,
    spreadPct: bestAsk && bestBid ? ((bestBid - bestAsk) / bestAsk) * 100 : null,
    isCrossed,
    nAdsAsk: asks.length,
    nAdsBid: bids.length,
    liquidityAskUsdt: asks.reduce((s, a) => s + a.surplusUsdt, 0),
    liquidityBidUsdt: bids.reduce((s, a) => s + a.surplusUsdt, 0),
  };
}

export type RoundTrip = {
  capitalMzn: number;
  buy: ExecutionResult;
  sell: ExecutionResult;
  grossProfitMzn: number;
  grossPct: number;
  nOrders: number;
  residualUsdt: number;
  residualMarkedMzn: number;
};

/** Compra USDT com `capitalMzn` e revende de imediato — o resíduo não
 *  vendido (perna de venda parcialmente preenchida) é marcado a mercado ao
 *  preço do ask em vez de contado como perda, ver p2p_mzn_analyzer/analysis.py. */
export function roundTripForCapital(askAds: Ad[], bidAds: Ad[], capitalMzn: number): RoundTrip {
  const buy = simulateBuyUsdt(askAds, capitalMzn);
  const sell = simulateSellUsdt(bidAds, buy.outputAmount);

  const residualUsdt = buy.outputAmount - sell.inputUsed;
  const markPrice = askAds.find((a) => a.side === "SELL")?.price ?? sell.vwapPrice ?? buy.vwapPrice ?? 0;
  const residualMarkedMzn = residualUsdt * markPrice;

  const gross = sell.outputAmount + residualMarkedMzn - buy.inputUsed;
  const grossPct = buy.inputUsed ? (gross / buy.inputUsed) * 100 : 0;
  const nOrders = buy.steps.length + sell.steps.length;

  return {
    capitalMzn, buy, sell,
    grossProfitMzn: gross, grossPct, nOrders,
    residualUsdt, residualMarkedMzn,
  };
}

export type NetScenario = { feeMzn: number; netMzn: number; netPct: number };

export function netByScenario(trip: RoundTrip): Record<CostScenario["label"], NetScenario> {
  const avgPrice = ((trip.buy.vwapPrice ?? 0) + (trip.sell.vwapPrice ?? 0)) / 2 || 1;
  const out = {} as Record<CostScenario["label"], NetScenario>;
  for (const scenario of ALL_SCENARIOS) {
    const feeMzn = trip.nOrders * scenario.takerFeeUsdt * avgPrice;
    const netMzn = trip.grossProfitMzn - feeMzn;
    const netPct = trip.buy.inputUsed ? (netMzn / trip.buy.inputUsed) * 100 : 0;
    out[scenario.label] = { feeMzn, netMzn, netPct };
  }
  return out;
}

export type EntryRuleSettings = {
  minGrossSpreadPct: number;
  minCounterpartyFinishRate: number;
  minCounterpartyMonthlyOrders: number;
  maxOrdersPerLeg: number;
  minNetPctAlert: number;
};

export type OpportunityEvaluation = {
  summary: MarketSummary;
  trip: RoundTrip;
  net: Record<CostScenario["label"], NetScenario>;
  meetsEntryRules: boolean;
  reasonsBlocked: string[];
};

/** Avalia a oportunidade actual contra o capital configurado e as regras de
 *  entrada objectivas. `meetsEntryRules=true` é a condição exacta que
 *  dispara um alerta (ver app/api/cron/scan/route.ts). */
export function evaluateOpportunity(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number,
  rules: EntryRuleSettings
): OpportunityEvaluation {
  const summary = marketSummary(askAds, bidAds);
  const trip = roundTripForCapital(askAds, bidAds, capitalMzn);
  const net = netByScenario(trip);

  const reasons: string[] = [];

  if (!summary.isCrossed) reasons.push("livro não está cruzado (melhor compra ≤ melhor venda)");
  if ((summary.spreadPct ?? 0) < rules.minGrossSpreadPct)
    reasons.push(`spread nominal ${(summary.spreadPct ?? 0).toFixed(2)}% abaixo do mínimo ${rules.minGrossSpreadPct}%`);
  if (!trip.buy.fullyFilled) reasons.push("capital não preenche na compra (limite mínimo dos anúncios)");
  if (trip.residualUsdt > 0.0001) reasons.push("perna de venda preenche apenas parcialmente (sobra USDT)");
  if (trip.nOrders > rules.maxOrdersPerLeg * 2) reasons.push(`precisa de ${trip.nOrders} ordens (máximo ${rules.maxOrdersPerLeg * 2})`);

  const allSteps = [...trip.buy.steps, ...trip.sell.steps];
  const badCounterparty = allSteps.find(
    (s) =>
      (s.monthFinishRate ?? 0) < rules.minCounterpartyFinishRate ||
      (s.monthOrders ?? 0) < rules.minCounterpartyMonthlyOrders
  );
  if (badCounterparty)
    reasons.push(`contraparte ${badCounterparty.merchantName} abaixo do limiar de reputação`);

  if (net.medio.netPct < rules.minNetPctAlert)
    reasons.push(`lucro líquido esperado ${net.medio.netPct.toFixed(2)}% abaixo do mínimo ${rules.minNetPctAlert}%`);

  return { summary, trip, net, meetsEntryRules: reasons.length === 0, reasonsBlocked: reasons };
}

// --------------------------------------------------------------------------
// Perfil de comerciantes — porte de p2p_mzn_analyzer/analysis.py
// --------------------------------------------------------------------------

export type MerchantCrossSide = {
  merchantId: string;
  merchantName: string;
  merchantType: string;
  nAdsAsk: number;
  nAdsBid: number;
  bestAsk: number;
  bestBid: number;
  spreadOwnAbs: number;
  spreadOwnPct: number;
  monthOrders: number | null;
  monthFinishRate: number | null;
  positiveRate: number | null;
  payMethods: string[];
};

/** Comerciantes com anúncios dos dois lados ao mesmo tempo — o sinal mais
 *  próximo de "isto é um market maker" que dá para observar sem histórico. */
export function merchantCrossSide(askAds: Ad[], bidAds: Ad[]): MerchantCrossSide[] {
  const asksByMerchant = new Map<string, Ad[]>();
  const bidsByMerchant = new Map<string, Ad[]>();
  for (const a of askAds) {
    if (!a.merchantId) continue;
    (asksByMerchant.get(a.merchantId) ?? asksByMerchant.set(a.merchantId, []).get(a.merchantId)!).push(a);
  }
  for (const b of bidAds) {
    if (!b.merchantId) continue;
    (bidsByMerchant.get(b.merchantId) ?? bidsByMerchant.set(b.merchantId, []).get(b.merchantId)!).push(b);
  }

  const result: MerchantCrossSide[] = [];
  for (const [merchantId, asks] of asksByMerchant) {
    const bids = bidsByMerchant.get(merchantId);
    if (!bids) continue;
    const bestAsk = Math.min(...asks.map((a) => a.price));
    const bestBid = Math.max(...bids.map((b) => b.price));
    result.push({
      merchantId,
      merchantName: asks[0].merchantName,
      merchantType: asks[0].merchantType,
      nAdsAsk: asks.length,
      nAdsBid: bids.length,
      bestAsk,
      bestBid,
      spreadOwnAbs: bestBid - bestAsk,
      spreadOwnPct: bestAsk ? ((bestBid - bestAsk) / bestAsk) * 100 : 0,
      monthOrders: asks[0].monthOrders,
      monthFinishRate: asks[0].monthFinishRate,
      positiveRate: asks[0].positiveRate,
      payMethods: Array.from(new Set([...asks, ...bids].flatMap((a) => a.payMethods))),
    });
  }
  return result.sort((a, b) => (b.monthOrders ?? 0) - (a.monthOrders ?? 0));
}

export type TopMerchant = {
  merchantId: string;
  merchantName: string;
  merchantType: string;
  monthOrders: number | null;
  monthFinishRate: number | null;
  positiveRate: number | null;
  sides: ("BUY" | "SELL")[];
  priceMin: number;
  priceMax: number;
};

export function topMerchantsByActivity(askAds: Ad[], bidAds: Ad[], n = 20): TopMerchant[] {
  const seen = new Map<string, { ad: Ad; sides: Set<"BUY" | "SELL">; prices: number[] }>();
  for (const a of [...askAds, ...bidAds]) {
    if (!a.merchantId) continue;
    const rec = seen.get(a.merchantId) ?? { ad: a, sides: new Set(), prices: [] };
    rec.sides.add(a.side);
    rec.prices.push(a.price);
    seen.set(a.merchantId, rec);
  }
  return Array.from(seen.entries())
    .map(([merchantId, rec]) => ({
      merchantId,
      merchantName: rec.ad.merchantName,
      merchantType: rec.ad.merchantType,
      monthOrders: rec.ad.monthOrders,
      monthFinishRate: rec.ad.monthFinishRate,
      positiveRate: rec.ad.positiveRate,
      sides: Array.from(rec.sides),
      priceMin: Math.min(...rec.prices),
      priceMax: Math.max(...rec.prices),
    }))
    .sort((a, b) => (b.monthOrders ?? 0) - (a.monthOrders ?? 0))
    .slice(0, n);
}

// --------------------------------------------------------------------------
// Oportunidade por contraparte — "se eu vender a ESTA pessoa especificamente"
// --------------------------------------------------------------------------

export type CounterpartyOption = {
  bidAd: Ad;
  usdtSold: number;
  mznReceived: number;
  residualUsdt: number;
  grossProfitMzn: number;
  grossPct: number;
  net: Record<CostScenario["label"], NetScenario>;
  usable: boolean;
};

/** Para o capital dado, compra sempre pelo caminho óptimo (ask mais barato
 *  primeiro — não há razão para comprar pior), mas em vez de vender pelo
 *  caminho óptimo, testa CADA anúncio de compra individualmente, incluindo
 *  os de baixa reputação — quem decide se confia ou não é o utilizador, o
 *  sistema não escolhe por ele aqui. Devolve todas as opções ordenadas por
 *  lucro líquido, para o utilizador comparar e escolher com quem negociar. */
export function evaluateSellCounterparties(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number
): { buy: ExecutionResult; options: CounterpartyOption[] } {
  const buy = simulateBuyUsdt(askAds, capitalMzn);
  const askBestPrice = [...askAds].filter((a) => a.side === "SELL" && a.price > 0).sort((a, b) => a.price - b.price)[0]?.price ?? 0;

  const bids = bidAds.filter((b) => b.side === "BUY" && b.price > 0);
  const options: CounterpartyOption[] = bids.map((bidAd) => {
    const capMzn = Math.min(
      ...[bidAd.maxMznDeclared, bidAd.maxMznDynamic, bidAd.surplusUsdt * bidAd.price].filter((v) => v > 0)
    );
    const capUsdt = bidAd.price ? capMzn / bidAd.price : 0;
    const minUsdt = bidAd.price ? bidAd.minMzn / bidAd.price : 0;
    const usable = capUsdt > 0 && buy.outputAmount >= minUsdt;

    const usdtSold = usable ? Math.min(buy.outputAmount, capUsdt) : 0;
    const mznReceived = usdtSold * bidAd.price;
    const residualUsdt = buy.outputAmount - usdtSold;
    const residualMarkedMzn = residualUsdt * askBestPrice;

    const grossProfitMzn = mznReceived + residualMarkedMzn - buy.inputUsed;
    const grossPct = buy.inputUsed ? (grossProfitMzn / buy.inputUsed) * 100 : 0;
    const nOrders = buy.steps.length + (usable ? 1 : 0);
    const avgPrice = ((buy.vwapPrice ?? 0) + bidAd.price) / 2 || 1;

    const net = {} as Record<CostScenario["label"], NetScenario>;
    for (const scenario of ALL_SCENARIOS) {
      const feeMzn = nOrders * scenario.takerFeeUsdt * avgPrice;
      const netMzn = grossProfitMzn - feeMzn;
      const netPct = buy.inputUsed ? (netMzn / buy.inputUsed) * 100 : 0;
      net[scenario.label] = { feeMzn, netMzn, netPct };
    }

    return { bidAd, usdtSold, mznReceived, residualUsdt, grossProfitMzn, grossPct, net, usable };
  });

  // Opções usáveis primeiro (as únicas em que a venda de facto acontece),
  // ordenadas da melhor para a pior dentro desse grupo. As não usáveis vêm
  // sempre depois, senão o seu "lucro" de ~-taxas (uma venda que nunca
  // chega a existir) engana ao aparecer misturado com trocas reais.
  options.sort((a, b) => {
    if (a.usable !== b.usable) return a.usable ? -1 : 1;
    return b.net.medio.netMzn - a.net.medio.netMzn;
  });
  return { buy, options };
}
