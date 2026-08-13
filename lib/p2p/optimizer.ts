/**
 * Motor de optimização — a resposta a "haverá lucro que não estamos a ver?".
 *
 * O resto da app pergunta sempre a mesma coisa: "com ESTE capital, a
 * comprar do mais barato para o mais caro, quanto ganho?". Isso deixa
 * dinheiro em cima da mesa por duas razões:
 *
 * 1. **O capital configurado raramente é o tamanho óptimo.** A taxa da
 *    Binance é FIXA por ordem, e os anúncios têm mínimos e máximos. Isso
 *    torna o lucro uma função aos degraus, não uma recta: 4.800 MZN pode
 *    render mais em termos absolutos do que 5.000 MZN, porque cabe em duas
 *    ordens em vez de três. Aqui procuramos o tamanho que maximiza o lucro
 *    de facto.
 *
 * 2. **Comprar sempre ao mais barato pode ser a pior escolha.** O anúncio
 *    mais barato pode ter um mínimo alto, pouca liquidez, ou obrigar a
 *    partir a ordem em três — e três taxas fixas comem a diferença de
 *    preço. Testar TODOS os pares (de quem compro × a quem vendo) encontra
 *    combinações de uma ordem por perna que a varredura gulosa nunca vê.
 */
import {
  ALL_SCENARIOS,
  computeCosts,
  DEFAULT_COST_PREFERENCES,
  type CostPreferences,
} from "./fees";
import { maxMznExecutable, type Ad } from "./orderbook";
import {
  netByScenario,
  roundTripForCapital,
  roundTripFromPools,
  type BalancedRoundTrip,
  type NetByScenario,
  type RoundTrip,
} from "./analysis";

// ---------------------------------------------------------------------------
// 1. Tamanho óptimo de operação
// ---------------------------------------------------------------------------

export type SizePoint = {
  capitalMzn: number;
  netMzn: number;
  netPct: number;
  nOrders: number;
  fullyFilled: boolean;
};

export type OptimalSize = {
  /** O tamanho que rende mais MZN em termos absolutos. */
  bestAbsolute: SizePoint | null;
  /** O tamanho que rende mais por Metical investido (melhor ROI). Nem
   *  sempre é o mesmo: operar pequeno costuma dar melhor %, operar grande
   *  costuma dar mais dinheiro. */
  bestRoi: SizePoint | null;
  /** Curva completa para desenhar — lucro em função do tamanho. */
  curve: SizePoint[];
  /** Lucro do capital configurado, para comparar com o óptimo. */
  atConfigured: SizePoint | null;
};

const CURVE_RESOLUTION = 80;

/**
 * Gera os tamanhos que vale a pena testar. Os pontos interessantes não
 * estão distribuídos por igual: estão exactamente nos limites dos anúncios
 * (onde uma ordem passa a ser precisa, ou deixa de ser). Por isso a lista
 * junta esses degraus reais a uma grelha uniforme.
 */
function candidateSizes(askAds: Ad[], maxCapitalMzn: number, configuredMzn: number): number[] {
  const asks = askAds
    .filter((a) => a.side === "SELL" && a.price > 0)
    .sort((a, b) => a.price - b.price);

  const set = new Set<number>();
  const push = (v: number) => {
    if (Number.isFinite(v) && v > 0 && v <= maxCapitalMzn) set.add(Math.round(v * 100) / 100);
  };

  // Degraus reais do livro: capacidade acumulada e mínimos de cada anúncio.
  let cumulative = 0;
  for (const ad of asks) {
    const cap = maxMznExecutable(ad);
    if (cap <= 0) continue;
    push(ad.minMzn);
    cumulative += cap;
    push(cumulative);
    push(cumulative - 0.01);
  }

  // Grelha uniforme por cima, para não haver buracos entre degraus.
  for (let i = 1; i <= CURVE_RESOLUTION; i++) push((maxCapitalMzn * i) / CURVE_RESOLUTION);

  push(configuredMzn);
  push(maxCapitalMzn);

  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Varre tamanhos de operação e devolve o melhor em valor absoluto e o
 * melhor em percentagem. `maxCapitalMzn` é o tecto (normalmente o capital
 * disponível) — nunca sugerimos operar acima do que existe.
 */
export function findOptimalSize(
  askAds: Ad[],
  bidAds: Ad[],
  maxCapitalMzn: number,
  configuredMzn: number,
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES
): OptimalSize {
  if (maxCapitalMzn <= 0 || askAds.length === 0 || bidAds.length === 0) {
    return { bestAbsolute: null, bestRoi: null, curve: [], atConfigured: null };
  }

  const sizes = candidateSizes(askAds, maxCapitalMzn, configuredMzn);
  const curve: SizePoint[] = [];

  for (const capitalMzn of sizes) {
    const trip = roundTripForCapital(askAds, bidAds, capitalMzn);
    if (trip.buy.inputUsed <= 0) continue;
    const net = netByScenario(trip, prefs);
    curve.push({
      capitalMzn,
      netMzn: net.medio.netMzn,
      netPct: net.medio.netPct,
      nOrders: trip.nOrders,
      fullyFilled: trip.buy.fullyFilled && !trip.residualStuck,
    });
  }

  if (curve.length === 0) {
    return { bestAbsolute: null, bestRoi: null, curve: [], atConfigured: null };
  }

  const bestAbsolute = curve.reduce((best, p) => (p.netMzn > best.netMzn ? p : best), curve[0]);
  const bestRoi = curve.reduce((best, p) => (p.netPct > best.netPct ? p : best), curve[0]);

  const atConfigured =
    curve.reduce<SizePoint | null>((closest, p) => {
      if (!closest) return p;
      return Math.abs(p.capitalMzn - configuredMzn) < Math.abs(closest.capitalMzn - configuredMzn) ? p : closest;
    }, null) ?? null;

  return { bestAbsolute, bestRoi, curve, atConfigured };
}

// ---------------------------------------------------------------------------
// 2. Matriz de pares — "compro a este, vendo àquele"
// ---------------------------------------------------------------------------

export type AdPairOpportunity = {
  buyAd: Ad;
  sellAd: Ad;
  /** MZN gastos na compra. */
  spendMzn: number;
  usdtAmount: number;
  /** MZN recebidos na venda (bruto). */
  receiveMzn: number;
  grossProfitMzn: number;
  net: NetByScenario;
  netMzn: number;
  netPct: number;
  /** Spread nominal entre os dois anúncios, em %. */
  spreadPct: number;
  /** `true` quando este par usa exactamente duas ordens (uma por perna) —
   *  o formato mais barato possível, porque a taxa é fixa por ordem. */
  twoOrders: true;
  /** Pior reputação das duas contrapartes, para ordenar por risco. */
  worstFinishRate: number | null;
  worstMonthOrders: number | null;
};

/**
 * Testa todas as combinações possíveis de "compro a X, vendo a Y" com uma
 * única ordem de cada lado, e devolve as que dão mais lucro líquido.
 *
 * Porque é que isto encontra coisas que a varredura normal não encontra: a
 * varredura normal começa sempre no anúncio mais barato e vai descendo a
 * lista. Se esse anúncio só aceitar 800 MZN, o capital tem de ser repartido
 * por mais dois ou três anúncios — e cada um deles paga taxa fixa outra
 * vez. Um anúncio 5 cêntimos mais caro, mas que aceite o valor todo de uma
 * vez, pode render bastante mais no fim. A lógica gulosa nunca considera
 * essa hipótese; esta considera todas.
 */
export function findBestAdPairs(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number,
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES,
  limit = 25
): AdPairOpportunity[] {
  const asks = askAds.filter((a) => a.side === "SELL" && a.price > 0);
  const bids = bidAds.filter((b) => b.side === "BUY" && b.price > 0);
  if (asks.length === 0 || bids.length === 0 || capitalMzn <= 0) return [];

  const results: AdPairOpportunity[] = [];

  for (const buyAd of asks) {
    const buyCapMzn = Math.min(maxMznExecutable(buyAd), capitalMzn);
    if (buyCapMzn <= 0 || buyAd.minMzn > buyCapMzn) continue;

    const maxUsdtFromBuy = buyCapMzn / buyAd.price;
    const minUsdtFromBuy = buyAd.minMzn / buyAd.price;

    for (const sellAd of bids) {
      // Sem diferença de preço favorável não há nada a capturar — e testar
      // pares em prejuízo só encheria a lista de ruído.
      if (sellAd.price <= buyAd.price) continue;

      const sellCapMzn = maxMznExecutable(sellAd);
      if (sellCapMzn <= 0) continue;

      const maxUsdtFromSell = sellCapMzn / sellAd.price;
      const minUsdtFromSell = sellAd.minMzn / sellAd.price;

      const upperUsdt = Math.min(maxUsdtFromBuy, maxUsdtFromSell);
      const lowerUsdt = Math.max(minUsdtFromBuy, minUsdtFromSell);
      if (upperUsdt < lowerUsdt - 1e-9) continue;

      // Com preço de venda acima do de compra, o lucro bruto cresce
      // linearmente com o tamanho e a taxa é fixa — logo o máximo está
      // sempre no tecto.
      const usdtAmount = upperUsdt;
      if (usdtAmount <= 0) continue;

      const spendMzn = usdtAmount * buyAd.price;
      const receiveMzn = usdtAmount * sellAd.price;
      const grossProfitMzn = receiveMzn - spendMzn;
      const avgPrice = (buyAd.price + sellAd.price) / 2;

      const net = {} as NetByScenario;
      for (const scenario of ALL_SCENARIOS) {
        const costs = computeCosts(
          scenario,
          {
            takerOrders: 2,
            avgPriceMzn: avgPrice,
            buyVolumeMzn: spendMzn,
            sellVolumeMzn: receiveMzn,
            buyTransfers: 1,
          },
          prefs
        );
        const netMzn = grossProfitMzn - costs.totalMzn;
        net[scenario.label] = {
          feeMzn: costs.totalMzn,
          netMzn,
          netPct: spendMzn ? (netMzn / spendMzn) * 100 : 0,
          costs,
        };
      }

      if (net.medio.netMzn <= 0) continue;

      results.push({
        buyAd,
        sellAd,
        spendMzn,
        usdtAmount,
        receiveMzn,
        grossProfitMzn,
        net,
        netMzn: net.medio.netMzn,
        netPct: net.medio.netPct,
        spreadPct: ((sellAd.price - buyAd.price) / buyAd.price) * 100,
        twoOrders: true,
        worstFinishRate: minOrNull(buyAd.monthFinishRate, sellAd.monthFinishRate),
        worstMonthOrders: minOrNull(buyAd.monthOrders, sellAd.monthOrders),
      });
    }
  }

  results.sort((a, b) => b.netMzn - a.netMzn);
  return results.slice(0, limit);
}

function minOrNull(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

// ---------------------------------------------------------------------------
// 3. Melhor combinação com um número limitado de comerciantes
// ---------------------------------------------------------------------------

/** Quantos anúncios de cada lado entram na procura. Ordenados por preço, os
 *  que ficam de fora nunca ganhariam a nenhum destes. */
const SUBSET_POOL_CAP = 14;

/** Todos os conjuntos não vazios até `maxSize` elementos. */
function subsetsUpTo<T>(items: T[], maxSize: number): T[][] {
  const out: T[][] = [];
  const build = (start: number, current: T[]) => {
    if (current.length > 0) out.push([...current]);
    if (current.length === maxSize) return;
    for (let i = start; i < items.length; i++) {
      current.push(items[i]);
      build(i + 1, current);
      current.pop();
    }
  };
  build(0, []);
  return out;
}

/**
 * A MELHOR viagem usando no máximo `maxBuyAds` comerciantes na compra e
 * `maxSellAds` na venda (`null` = sem limite nesse lado).
 *
 * Isto substitui a versão que simplesmente cortava a lista nos N anúncios de
 * melhor preço. Essa abordagem tinha uma falha grave e silenciosa: se o
 * anúncio mais barato do livro exigir um mínimo de, digamos, 5.000 MZN, uma
 * simulação de 1.000 MZN em "1 por lado" devolvia uma viagem completamente
 * vazia — o ecrã não mostrava nada e parecia não haver oportunidade — quando
 * bastava usar o segundo ou terceiro anúncio mais barato, que aceitam
 * valores pequenos, para haver lucro.
 *
 * Aqui testam-se as combinações reais e escolhe-se a que rende mais depois
 * de custos, que é o que a pergunta "onde é que ganho mais?" realmente
 * significa.
 */
export function findBestLimitedRoundTrip(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number,
  { maxBuyAds, maxSellAds }: { maxBuyAds: number | null; maxSellAds: number | null },
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES
): BalancedRoundTrip {
  const asksPool = askAds.filter((a) => a.side === "SELL" && a.price > 0).sort((a, b) => a.price - b.price);
  const bidsPool = bidAds.filter((b) => b.side === "BUY" && b.price > 0).sort((a, b) => b.price - a.price);

  const empty = (): BalancedRoundTrip => ({
    ...roundTripFromPools([], [], capitalMzn, bidsPool),
    maxBuyAds,
    maxSellAds,
    unusedCapitalMzn: capitalMzn,
  });

  if (asksPool.length === 0 || bidsPool.length === 0 || capitalMzn <= 0) return empty();

  // Só entram na procura anúncios que este capital consegue mesmo tomar —
  // era exactamente isto que faltava antes.
  const usableAsks = asksPool
    .filter((a) => maxMznExecutable(a) > 0 && a.minMzn <= capitalMzn)
    .slice(0, SUBSET_POOL_CAP);
  const usableBids = bidsPool.filter((b) => maxMznExecutable(b) > 0).slice(0, SUBSET_POOL_CAP);

  if (usableAsks.length === 0) return empty();

  const buyCandidates: Ad[][] =
    maxBuyAds === null ? [asksPool] : subsetsUpTo(usableAsks, Math.max(1, maxBuyAds));
  const sellCandidates: Ad[][] =
    maxSellAds === null ? [bidsPool] : subsetsUpTo(usableBids, Math.max(1, maxSellAds));

  if (sellCandidates.length === 0) return empty();

  let best: BalancedRoundTrip | null = null;
  let bestNetMzn = -Infinity;

  for (const buyPool of buyCandidates) {
    for (const sellPool of sellCandidates) {
      const trip = roundTripFromPools(buyPool, sellPool, capitalMzn, bidsPool, {
        sellPoolIsWholeBook: maxSellAds === null,
      });
      if (trip.buy.inputUsed <= 0) continue;

      // Uma viagem em que a venda não executa não é uma viagem: é uma
      // compra a descoberto avaliada ao preço de outra pessoa. Sem esta
      // condição, a procura preferia essas combinações — parecem render
      // mais só porque poupam a taxa da ordem de venda que nunca chega a
      // acontecer.
      if (trip.sell.steps.length === 0) continue;

      const net = netByScenario(trip, prefs).medio.netMzn;
      // Empate desfaz-se a favor de quem negoceia mais capital: com o mesmo
      // lucro, é preferível a viagem que aproveita mais o dinheiro parado.
      const better =
        net > bestNetMzn + 1e-9 ||
        (Math.abs(net - bestNetMzn) <= 1e-9 && best !== null && trip.buy.inputUsed > best.buy.inputUsed);

      if (better) {
        bestNetMzn = net;
        best = {
          ...trip,
          maxBuyAds,
          maxSellAds,
          unusedCapitalMzn: Math.max(0, capitalMzn - trip.buy.inputUsed),
        };
      }
    }
  }

  return best ?? empty();
}

// ---------------------------------------------------------------------------
// 4. Comparação de estratégias
// ---------------------------------------------------------------------------

export type StrategyComparison = {
  key: "gulosa" | "par-unico" | "tamanho-optimo";
  label: string;
  description: string;
  netMzn: number;
  netPct: number;
  capitalUsedMzn: number;
  nOrders: number;
  available: boolean;
};

/**
 * Põe as estratégias lado a lado com os mesmos custos e o mesmo capital, e
 * diz qual delas rende mais AGORA. É a resposta directa à pergunta "estou a
 * fazer isto da melhor maneira?" — sem obrigar ninguém a comparar abas.
 */
export function compareStrategies(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number,
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES
): { rows: StrategyComparison[]; best: StrategyComparison | null; greedyTrip: RoundTrip } {
  const greedyTrip = roundTripForCapital(askAds, bidAds, capitalMzn);
  const greedyNet = netByScenario(greedyTrip, prefs);

  const pairs = findBestAdPairs(askAds, bidAds, capitalMzn, prefs, 1);
  const bestPair = pairs[0] ?? null;

  const optimal = findOptimalSize(askAds, bidAds, capitalMzn, capitalMzn, prefs);
  const bestSize = optimal.bestAbsolute;

  const rows: StrategyComparison[] = [
    {
      key: "gulosa",
      label: "Capital todo, melhor preço primeiro",
      description:
        "O modo clássico: gasta o capital configurado começando pelo anúncio mais barato e descendo a lista.",
      netMzn: greedyNet.medio.netMzn,
      netPct: greedyNet.medio.netPct,
      capitalUsedMzn: greedyTrip.buy.inputUsed,
      nOrders: greedyTrip.nOrders,
      available: greedyTrip.buy.inputUsed > 0,
    },
    {
      key: "par-unico",
      label: "Uma ordem de cada lado (par óptimo)",
      description:
        "Escolhe o par comprador/vendedor que rende mais com uma só ordem por perna — menos taxas fixas e execução muito mais rápida.",
      netMzn: bestPair?.netMzn ?? 0,
      netPct: bestPair?.netPct ?? 0,
      capitalUsedMzn: bestPair?.spendMzn ?? 0,
      nOrders: 2,
      available: bestPair !== null,
    },
    {
      key: "tamanho-optimo",
      label: "Tamanho óptimo de operação",
      description:
        "Mesmo caminho da estratégia clássica, mas com o valor que rende mais em vez do capital todo — às vezes operar menos rende mais.",
      netMzn: bestSize?.netMzn ?? 0,
      netPct: bestSize?.netPct ?? 0,
      capitalUsedMzn: bestSize?.capitalMzn ?? 0,
      nOrders: bestSize?.nOrders ?? 0,
      available: bestSize !== null && bestSize.netMzn > 0,
    },
  ];

  const availableRows = rows.filter((r) => r.available);
  const best =
    availableRows.length > 0
      ? availableRows.reduce((b, r) => (r.netMzn > b.netMzn ? r : b), availableRows[0])
      : null;

  return { rows, best, greedyTrip };
}
