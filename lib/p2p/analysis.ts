/**
 * Motor de análise: liga order book + custos + regras de entrada para
 * decidir se, AGORA, com O CAPITAL CONFIGURADO, existe uma oportunidade real
 * de captura de spread cruzado — a mesma estratégia (e as mesmas regras
 * objectivas de entrada/saída) descritas no relatório original
 * (Secção 10 / "Condições objetivas").
 *
 * Duas correcções importantes face à versão anterior:
 *
 * 1. O USDT que sobra por vender era marcado ao preço de COMPRA (ask). Isso
 *    é errado e sempre a favor: o ask é o que PAGAS por USDT, não o que
 *    consegues por ele. Marcar assim inventava lucro em todas as viagens
 *    com resíduo. Agora é marcado ao melhor preço a que ainda o poderias
 *    vender de facto — e a zero (com aviso) quando já não há comprador
 *    nenhum para ele.
 * 2. O custo só contava a taxa da Binance. Mover Meticais por M-Pesa/e-Mola
 *    custa dinheiro real e passou a entrar na conta (ver lib/p2p/fees.ts).
 */
import {
  ALL_SCENARIOS,
  computeCosts,
  DEFAULT_COST_PREFERENCES,
  type CostBreakdown,
  type CostPreferences,
  type CostScenarioLabel,
} from "./fees";
import { Ad, ExecutionResult, simulateBuyUsdt, simulateBuyUsdtTarget, simulateSellUsdt } from "./orderbook";

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
  /** Preço a que o resíduo foi marcado (melhor comprador ainda disponível
   *  para ele). `null` quando não há comprador nenhum — nesse caso o
   *  resíduo vale 0 nesta conta e isso é dito na interface, em vez de ser
   *  escondido num número inflacionado. */
  residualMarkPrice: number | null;
  /** `true` quando sobrou USDT e não existe comprador para ele agora. */
  residualStuck: boolean;
};

/**
 * A que preço o USDT que sobrou pode realmente ser convertido em Meticais.
 * Só conta anúncios de compra que a perna de venda ainda NÃO consumiu — os
 * que já foram usados estão (na prática desta simulação) esgotados.
 */
function markResidualPrice(allBidAds: Ad[], usedAdvNos: Set<string>): number | null {
  const available = allBidAds
    .filter((b) => b.side === "BUY" && b.price > 0 && !usedAdvNos.has(b.advNo))
    .sort((a, b) => b.price - a.price);
  return available[0]?.price ?? null;
}

function combineRoundTrip(
  buy: ExecutionResult,
  sell: ExecutionResult,
  allBidAds: Ad[],
  capitalMzn: number
): RoundTrip {
  const residualUsdt = Math.max(0, buy.outputAmount - sell.inputUsed);

  const usedAdvNos = new Set(sell.steps.map((s) => s.advNo));
  const markPrice = residualUsdt > 1e-9 ? markResidualPrice(allBidAds, usedAdvNos) : null;
  const residualMarkedMzn = residualUsdt * (markPrice ?? 0);

  const gross = sell.outputAmount + residualMarkedMzn - buy.inputUsed;
  const grossPct = buy.inputUsed ? (gross / buy.inputUsed) * 100 : 0;
  const nOrders = buy.steps.length + sell.steps.length;

  return {
    capitalMzn,
    buy,
    sell,
    grossProfitMzn: gross,
    grossPct,
    nOrders,
    residualUsdt,
    residualMarkedMzn,
    residualMarkPrice: markPrice,
    residualStuck: residualUsdt > 1e-4 && markPrice === null,
  };
}

/** Compra USDT com `capitalMzn` e revende de imediato. Usa o capital todo,
 *  por isso pode precisar de várias contrapartes de cada lado (ver
 *  roundTripLimited para a alternativa "poucos pontos"). */
export function roundTripForCapital(askAds: Ad[], bidAds: Ad[], capitalMzn: number): RoundTrip {
  const buy = simulateBuyUsdt(askAds, capitalMzn);
  const sell = simulateSellUsdt(bidAds, buy.outputAmount);
  return combineRoundTrip(buy, sell, bidAds, capitalMzn);
}

export type BalancedRoundTrip = RoundTrip & {
  /** `null` = sem limite (usa o livro todo desse lado). */
  maxBuyAds: number | null;
  maxSellAds: number | null;
  /** Capital configurado que não coube nesta viagem — mostrado sempre de
   *  forma explícita, nunca escondido nem forçado a mais ordens. */
  unusedCapitalMzn: number;
};

const SELL_CAPACITY_PROBE_USDT = 1e12;

/**
 * Alternativa ao "usa o capital todo": limita a viagem a, no máximo,
 * `maxBuyAds`/`maxSellAds` comerciantes de cada lado (`null` = sem limite
 * nesse lado) e negoceia o MAIOR valor que cabe ao mesmo tempo na compra E
 * na venda — nunca compra mais USDT do que consegue vender de volta a essas
 * contrapartes. O que sobrar do capital configurado fica de fora (ver
 * `unusedCapitalMzn`), nunca é forçado através de mais ordens.
 */
export function roundTripLimited(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number,
  { maxBuyAds, maxSellAds }: { maxBuyAds: number | null; maxSellAds: number | null }
): BalancedRoundTrip {
  const asksPool = askAds.filter((a) => a.side === "SELL" && a.price > 0).sort((a, b) => a.price - b.price);
  const bidsPool = bidAds.filter((b) => b.side === "BUY" && b.price > 0).sort((a, b) => b.price - a.price);

  const asksLimited = maxBuyAds !== null ? asksPool.slice(0, maxBuyAds) : asksPool;
  const bidsLimited = maxSellAds !== null ? bidsPool.slice(0, maxSellAds) : bidsPool;

  const buyFull = simulateBuyUsdt(asksLimited, capitalMzn);

  let buy: ExecutionResult;
  if (maxSellAds === null) {
    buy = buyFull;
  } else {
    const sellCapacityProbe = simulateSellUsdt(bidsLimited, SELL_CAPACITY_PROBE_USDT);
    const sellCapacityUsdt = sellCapacityProbe.inputUsed;
    buy =
      buyFull.outputAmount <= sellCapacityUsdt + 1e-9
        ? buyFull
        : simulateBuyUsdtTarget(asksLimited, sellCapacityUsdt, capitalMzn);
  }

  const sell = simulateSellUsdt(bidsLimited, buy.outputAmount);
  // O resíduo é marcado contra o livro TODO, não só contra os anúncios que
  // este modo permitiu usar: o USDT que sobra continua a ser vendável a
  // outra pessoa noutra altura, e fingir o contrário penalizaria os modos
  // "poucos comerciantes" sem razão real.
  const trip = combineRoundTrip(buy, sell, bidsPool, capitalMzn);

  return { ...trip, maxBuyAds, maxSellAds, unusedCapitalMzn: Math.max(0, capitalMzn - buy.inputUsed) };
}

export type NetScenario = {
  /** Custo total da viagem em MZN (Binance + transferências). */
  feeMzn: number;
  netMzn: number;
  netPct: number;
  costs: CostBreakdown;
};

export type NetByScenario = Record<CostScenarioLabel, NetScenario>;

export function netByScenario(
  trip: RoundTrip,
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES
): NetByScenario {
  const avgPrice = ((trip.buy.vwapPrice ?? 0) + (trip.sell.vwapPrice ?? 0)) / 2 || trip.buy.vwapPrice || 1;
  const out = {} as NetByScenario;
  for (const scenario of ALL_SCENARIOS) {
    const costs = computeCosts(
      scenario,
      {
        takerOrders: trip.nOrders,
        avgPriceMzn: avgPrice,
        buyVolumeMzn: trip.buy.inputUsed,
        sellVolumeMzn: trip.sell.outputAmount,
        buyTransfers: trip.buy.steps.length,
      },
      prefs
    );
    const netMzn = trip.grossProfitMzn - costs.totalMzn;
    const netPct = trip.buy.inputUsed ? (netMzn / trip.buy.inputUsed) * 100 : 0;
    out[scenario.label] = { feeMzn: costs.totalMzn, netMzn, netPct, costs };
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
  net: NetByScenario;
  meetsEntryRules: boolean;
  reasonsBlocked: string[];
};

/** Avalia a oportunidade actual contra o capital configurado e as regras de
 *  entrada objectivas. */
export function evaluateOpportunity(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number,
  rules: EntryRuleSettings,
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES
): OpportunityEvaluation {
  const summary = marketSummary(askAds, bidAds);
  const trip = roundTripForCapital(askAds, bidAds, capitalMzn);
  const net = netByScenario(trip, prefs);

  const reasons: string[] = [];

  if (!summary.isCrossed) reasons.push("livro não está cruzado (melhor compra ≤ melhor venda)");
  if ((summary.spreadPct ?? 0) < rules.minGrossSpreadPct)
    reasons.push(`spread nominal ${(summary.spreadPct ?? 0).toFixed(2)}% abaixo do mínimo ${rules.minGrossSpreadPct}%`);
  if (!trip.buy.fullyFilled) reasons.push("capital não preenche na compra (limite mínimo dos anúncios)");
  if (trip.residualUsdt > 0.0001) reasons.push("perna de venda preenche apenas parcialmente (sobra USDT)");
  if (trip.residualStuck) reasons.push("o USDT que sobra não tem comprador nenhum no livro agora");
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
    const list = asksByMerchant.get(a.merchantId);
    if (list) list.push(a);
    else asksByMerchant.set(a.merchantId, [a]);
  }
  for (const b of bidAds) {
    if (!b.merchantId) continue;
    const list = bidsByMerchant.get(b.merchantId);
    if (list) list.push(b);
    else bidsByMerchant.set(b.merchantId, [b]);
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
    const rec = seen.get(a.merchantId) ?? { ad: a, sides: new Set<"BUY" | "SELL">(), prices: [] };
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
  residualMarkPrice: number | null;
  grossProfitMzn: number;
  grossPct: number;
  net: NetByScenario;
  usable: boolean;
};

/** Para o capital dado, compra sempre pelo caminho óptimo (ask mais barato
 *  primeiro — não há razão para comprar pior), mas em vez de vender pelo
 *  caminho óptimo, testa CADA anúncio de compra individualmente, incluindo
 *  os de baixa reputação — quem decide se confia ou não é o utilizador. */
export function evaluateSellCounterparties(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number,
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES
): { buy: ExecutionResult; options: CounterpartyOption[] } {
  const buy = simulateBuyUsdt(askAds, capitalMzn);
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

    // Resíduo marcado ao melhor comprador ALTERNATIVO (não a este, que já
    // foi usado, nem ao preço de compra como antes) — é o único valor que
    // representa dinheiro que poderias mesmo receber.
    const residualMarkPrice =
      residualUsdt > 1e-9 ? markResidualPrice(bidAds, new Set([bidAd.advNo])) : null;
    const residualMarkedMzn = residualUsdt * (residualMarkPrice ?? 0);

    const grossProfitMzn = mznReceived + residualMarkedMzn - buy.inputUsed;
    const grossPct = buy.inputUsed ? (grossProfitMzn / buy.inputUsed) * 100 : 0;
    const nOrders = buy.steps.length + (usable ? 1 : 0);
    const avgPrice = ((buy.vwapPrice ?? 0) + bidAd.price) / 2 || 1;

    const net = {} as NetByScenario;
    for (const scenario of ALL_SCENARIOS) {
      const costs = computeCosts(
        scenario,
        {
          takerOrders: nOrders,
          avgPriceMzn: avgPrice,
          buyVolumeMzn: buy.inputUsed,
          sellVolumeMzn: mznReceived,
          buyTransfers: buy.steps.length,
        },
        prefs
      );
      const netMzn = grossProfitMzn - costs.totalMzn;
      const netPct = buy.inputUsed ? (netMzn / buy.inputUsed) * 100 : 0;
      net[scenario.label] = { feeMzn: costs.totalMzn, netMzn, netPct, costs };
    }

    return { bidAd, usdtSold, mznReceived, residualUsdt, residualMarkPrice, grossProfitMzn, grossPct, net, usable };
  });

  options.sort((a, b) => {
    if (a.usable !== b.usable) return a.usable ? -1 : 1;
    return b.net.medio.netMzn - a.net.medio.netMzn;
  });
  return { buy, options };
}
