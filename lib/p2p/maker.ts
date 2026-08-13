/**
 * Estratégia de ANÚNCIO PRÓPRIO (maker) — a fonte de lucro que a app
 * ignorava por completo.
 *
 * Até aqui o sistema só sabia responder a "quanto ganho se aceitar os
 * anúncios que já existem?". Mas quem ganha dinheiro a sério neste mercado
 * (ver /comerciantes: os que aparecem a comprar E a vender ao mesmo tempo)
 * não aceita anúncios — publica os seus. A diferença é enorme:
 *
 * - Tomar anúncios só dá lucro quando o livro está CRUZADO, o que acontece
 *   poucos minutos por dia, e a margem é de 0,2%–0,5%.
 * - Publicar anúncios dentro do spread dá lucro em livro NORMAL, que é
 *   quase sempre, e a margem é o spread inteiro — tipicamente 1,5%–4%.
 *
 * A contrapartida é o tempo: um anúncio próprio não preenche no instante,
 * fica à espera de contraparte. Por isso cada estratégia aqui vem com o
 * risco explícito, nunca só com o número bonito.
 */
import {
  ALL_SCENARIOS,
  computeCosts,
  DEFAULT_COST_PREFERENCES,
  type CostPreferences,
} from "./fees";
import { maxMznExecutable, simulateBuyUsdt, type Ad } from "./orderbook";
import type { NetByScenario } from "./analysis";

/** Menor variação de preço que a Binance aceita neste par. Publicar a
 *  exactamente o mesmo preço do primeiro classificado não te põe à frente
 *  dele — é preciso melhorar pelo menos um cêntimo. */
export const PRICE_TICK_MZN = 0.01;

export type MakerLeg = {
  /** Preço a publicar no anúncio. */
  price: number;
  /** Quão à frente ficas do próximo anúncio concorrente, em MZN. */
  edgeOverNextMzn: number;
  /** Quantos anúncios continuam à tua frente a este preço (0 = ficas em
   *  primeiro lugar). */
  adsAhead: number;
};

export type FillRisk = "baixo" | "medio" | "alto";

export type MakerStrategy = {
  key: "maker-total" | "compra-imediata-venda-anunciada" | "compra-anunciada-venda-imediata";
  label: string;
  /** Explicação em linguagem simples do que fazer, passo a passo. */
  steps: string[];
  buyPrice: number;
  sellPrice: number;
  capitalUsedMzn: number;
  usdtAmount: number;
  grossProfitMzn: number;
  net: NetByScenario;
  netMzn: number;
  netPct: number;
  /** Margem bruta entre publicar e fechar, em %. */
  marginPct: number;
  /** Quantas das duas pernas dependem de esperar por contraparte. */
  legsWaiting: 0 | 1 | 2;
  fillRisk: FillRisk;
  riskNote: string;
  buyLeg: MakerLeg | null;
  sellLeg: MakerLeg | null;
  available: boolean;
  unavailableReason?: string;
};

function sortedAsks(askAds: Ad[]): Ad[] {
  return askAds.filter((a) => a.side === "SELL" && a.price > 0).sort((a, b) => a.price - b.price);
}
function sortedBids(bidAds: Ad[]): Ad[] {
  return bidAds.filter((b) => b.side === "BUY" && b.price > 0).sort((a, b) => b.price - a.price);
}

/**
 * Quanta concorrência real tens ao publicar a este preço. Não é só "sou o
 * primeiro?" — é também quanto volume está empatado à tua frente, porque um
 * anúncio de 200 MZN à frente do teu não te atrasa nada e um de 200.000 MZN
 * atrasa muito.
 */
function legCompetition(price: number, competitors: Ad[], side: "buy" | "sell"): MakerLeg {
  const better = competitors.filter((c) => (side === "buy" ? c.price > price : c.price < price));
  const next = competitors.find((c) => (side === "buy" ? c.price <= price : c.price >= price));
  return {
    price,
    edgeOverNextMzn: next ? Math.abs(price - next.price) : 0,
    adsAhead: better.length,
  };
}

function assessFillRisk(legsWaiting: 0 | 1 | 2, buyLeg: MakerLeg | null, sellLeg: MakerLeg | null): {
  risk: FillRisk;
  note: string;
} {
  if (legsWaiting === 0) {
    return { risk: "baixo", note: "Ambas as pernas executam já — nada fica à espera." };
  }

  const legs = [buyLeg, sellLeg].filter((l): l is MakerLeg => l !== null);
  const anyBehind = legs.some((l) => l.adsAhead > 0);
  const thinEdge = legs.some((l) => l.edgeOverNextMzn < PRICE_TICK_MZN * 2);

  if (legsWaiting === 2) {
    return {
      risk: "alto",
      note:
        "As duas pernas dependem de alguém aceitar os teus anúncios. É a margem mais alta, mas o capital pode ficar parado horas — e se só uma perna preencher, ficas com posição aberta.",
    };
  }

  if (anyBehind) {
    return {
      risk: "alto",
      note: "Há anúncios melhores do que o teu à frente na lista — só te procuram depois de esgotarem esses.",
    };
  }
  if (thinEdge) {
    return {
      risk: "medio",
      note: "Ficas em primeiro lugar por uma margem mínima — qualquer concorrente que baixe um cêntimo passa-te à frente.",
    };
  }
  return {
    risk: "medio",
    note: "Uma perna executa já, a outra fica publicada à espera. Ficas em primeiro lugar com folga confortável.",
  };
}

function buildNet(
  grossProfitMzn: number,
  spendMzn: number,
  receiveMzn: number,
  avgPrice: number,
  takerOrders: number,
  makerVolumeMzn: number,
  buyTransfers: number,
  prefs: CostPreferences
): NetByScenario {
  const net = {} as NetByScenario;
  for (const scenario of ALL_SCENARIOS) {
    const costs = computeCosts(
      scenario,
      {
        takerOrders,
        avgPriceMzn: avgPrice,
        buyVolumeMzn: spendMzn,
        sellVolumeMzn: receiveMzn,
        makerVolumeMzn,
        buyTransfers,
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
  return net;
}

export type MakerAnalysis = {
  bestAsk: number | null;
  bestBid: number | null;
  /** Espaço utilizável entre o melhor comprador e o melhor vendedor, em
   *  MZN por USDT. É isto que se pode capturar publicando anúncios. */
  spreadAbsMzn: number | null;
  spreadPct: number | null;
  strategies: MakerStrategy[];
  best: MakerStrategy | null;
};

/**
 * Avalia as três formas de usar anúncios próprios com o capital dado.
 */
export function evaluateMakerStrategies(
  askAds: Ad[],
  bidAds: Ad[],
  capitalMzn: number,
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES
): MakerAnalysis {
  const asks = sortedAsks(askAds);
  const bids = sortedBids(bidAds);
  const bestAsk = asks[0]?.price ?? null;
  const bestBid = bids[0]?.price ?? null;

  if (bestAsk === null || bestBid === null || capitalMzn <= 0) {
    return { bestAsk, bestBid, spreadAbsMzn: null, spreadPct: null, strategies: [], best: null };
  }

  const spreadAbsMzn = bestAsk - bestBid;
  const spreadPct = (spreadAbsMzn / bestAsk) * 100;
  const strategies: MakerStrategy[] = [];

  // -------------------------------------------------------------------
  // A. Maker total — anúncio de compra E anúncio de venda dentro do spread
  // -------------------------------------------------------------------
  {
    const buyPrice = bestBid + PRICE_TICK_MZN;
    const sellPrice = bestAsk - PRICE_TICK_MZN;
    const viable = sellPrice > buyPrice;

    const usdtAmount = viable ? capitalMzn / buyPrice : 0;
    const spendMzn = viable ? capitalMzn : 0;
    const receiveMzn = usdtAmount * sellPrice;
    const grossProfitMzn = receiveMzn - spendMzn;
    const avgPrice = (buyPrice + sellPrice) / 2;

    const net = buildNet(grossProfitMzn, spendMzn, receiveMzn, avgPrice, 0, spendMzn + receiveMzn, 1, prefs);
    const buyLeg = legCompetition(buyPrice, bids, "buy");
    const sellLeg = legCompetition(sellPrice, asks, "sell");
    const { risk, note } = assessFillRisk(2, buyLeg, sellLeg);

    strategies.push({
      key: "maker-total",
      label: "Fazer mercado — os dois anúncios são teus",
      steps: [
        `Publica um anúncio a COMPRAR USDT a ${buyPrice.toFixed(2)} MZN (um cêntimo acima do melhor comprador actual).`,
        "Espera que alguém te venda USDT a esse preço.",
        `Publica um anúncio a VENDER esse USDT a ${sellPrice.toFixed(2)} MZN (um cêntimo abaixo do vendedor mais barato).`,
        "Espera que alguém te compre. A diferença entre os dois preços fica para ti.",
      ],
      buyPrice,
      sellPrice,
      capitalUsedMzn: spendMzn,
      usdtAmount,
      grossProfitMzn,
      net,
      netMzn: net.medio.netMzn,
      netPct: net.medio.netPct,
      marginPct: viable ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0,
      legsWaiting: 2,
      fillRisk: risk,
      riskNote: note,
      buyLeg,
      sellLeg,
      available: viable && net.medio.netMzn > 0,
      unavailableReason: !viable
        ? "O spread está demasiado apertado — não há espaço para pôr os dois anúncios entre o melhor comprador e o melhor vendedor."
        : net.medio.netMzn <= 0
          ? "O spread não chega para cobrir as taxas."
          : undefined,
    });
  }

  // -------------------------------------------------------------------
  // B. Compra imediata (taker) + venda anunciada (maker)
  //    Compras já ao preço real do livro e publicas a venda a um preço que
  //    te põe em primeiro lugar na lista de vendedores.
  // -------------------------------------------------------------------
  {
    const buy = simulateBuyUsdt(askAds, capitalMzn);
    const spendMzn = buy.inputUsed;
    const usdtAmount = buy.outputAmount;
    const buyPrice = buy.vwapPrice ?? bestAsk;

    // Depois de comprares, os anúncios que consumiste deixam de contar como
    // concorrência — a referência passa a ser o vendedor mais barato que
    // sobrou.
    const consumed = new Set(buy.steps.map((s) => s.advNo));
    const remainingAsks = asks.filter((a) => !consumed.has(a.advNo));
    const referenceAsk = remainingAsks[0]?.price ?? bestAsk;
    const sellPrice = referenceAsk - PRICE_TICK_MZN;

    const receiveMzn = usdtAmount * sellPrice;
    const grossProfitMzn = receiveMzn - spendMzn;
    const avgPrice = (buyPrice + sellPrice) / 2;

    const net = buildNet(
      grossProfitMzn,
      spendMzn,
      receiveMzn,
      avgPrice,
      buy.steps.length,
      receiveMzn,
      buy.steps.length,
      prefs
    );
    const sellLeg = legCompetition(sellPrice, remainingAsks, "sell");
    const { risk, note } = assessFillRisk(1, null, sellLeg);
    const viable = spendMzn > 0 && sellPrice > buyPrice;

    strategies.push({
      key: "compra-imediata-venda-anunciada",
      label: "Comprar já, anunciar a venda",
      steps: [
        `Compra ${usdtAmount.toFixed(2)} USDT agora, nos anúncios existentes (preço médio ${buyPrice.toFixed(2)} MZN).`,
        `Publica um anúncio a VENDER a ${sellPrice.toFixed(2)} MZN — fica o vendedor mais barato da lista.`,
        "Quem quiser comprar USDT encontra-te em primeiro lugar. Não pagas taxa de quem toma o anúncio nessa perna.",
      ],
      buyPrice,
      sellPrice,
      capitalUsedMzn: spendMzn,
      usdtAmount,
      grossProfitMzn,
      net,
      netMzn: net.medio.netMzn,
      netPct: net.medio.netPct,
      marginPct: buyPrice ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0,
      legsWaiting: 1,
      fillRisk: risk,
      riskNote: note,
      buyLeg: null,
      sellLeg,
      available: viable && net.medio.netMzn > 0,
      unavailableReason:
        spendMzn <= 0
          ? "Não há anúncios de venda compatíveis com este capital."
          : sellPrice <= buyPrice
            ? "Depois de comprares, o vendedor mais barato que sobra está abaixo do que pagaste — não dá para publicar acima."
            : net.medio.netMzn <= 0
              ? "A diferença não cobre as taxas."
              : undefined,
    });
  }

  // -------------------------------------------------------------------
  // C. Compra anunciada (maker) + venda imediata (taker)
  //    Só faz sentido em livro cruzado: publicas a compra abaixo do que
  //    alguém já está a pagar, e despachas logo.
  // -------------------------------------------------------------------
  {
    const buyPrice = bestBid + PRICE_TICK_MZN;
    // Vendes de imediato ao melhor comprador que pague mais do que
    // publicaste — em livro normal isso não existe.
    const sellTarget = bids.find((b) => b.price > buyPrice);
    const sellPrice = sellTarget?.price ?? 0;
    const sellCapUsdt = sellTarget ? maxMznExecutable(sellTarget) / sellTarget.price : 0;

    const usdtWanted = capitalMzn / buyPrice;
    const usdtAmount = Math.min(usdtWanted, sellCapUsdt);
    const spendMzn = usdtAmount * buyPrice;
    const receiveMzn = usdtAmount * sellPrice;
    const grossProfitMzn = receiveMzn - spendMzn;
    const avgPrice = (buyPrice + (sellPrice || buyPrice)) / 2;

    const net = buildNet(grossProfitMzn, spendMzn, receiveMzn, avgPrice, 1, spendMzn, 1, prefs);
    const buyLeg = legCompetition(buyPrice, bids, "buy");
    const { risk, note } = assessFillRisk(1, buyLeg, null);
    const viable = sellTarget !== undefined && usdtAmount > 0;

    strategies.push({
      key: "compra-anunciada-venda-imediata",
      label: "Anunciar a compra, vender já",
      steps: [
        `Publica um anúncio a COMPRAR USDT a ${buyPrice.toFixed(2)} MZN — ficas o comprador mais generoso da lista.`,
        "Espera que alguém te venda USDT a esse preço.",
        sellTarget
          ? `Vende logo a ${sellPrice.toFixed(2)} MZN a ${sellTarget.merchantName}, que já está a pagar mais do que publicaste.`
          : "Vende de imediato assim que aparecer um comprador acima do teu preço.",
      ],
      buyPrice,
      sellPrice,
      capitalUsedMzn: spendMzn,
      usdtAmount,
      grossProfitMzn,
      net,
      netMzn: net.medio.netMzn,
      netPct: net.medio.netPct,
      marginPct: buyPrice ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0,
      legsWaiting: 1,
      fillRisk: risk,
      riskNote: note,
      buyLeg,
      sellLeg: null,
      available: viable && net.medio.netMzn > 0,
      unavailableReason: !sellTarget
        ? "Só funciona com o livro cruzado — agora ninguém está a pagar mais do que aquilo que terias de publicar."
        : net.medio.netMzn <= 0
          ? "A diferença não cobre as taxas."
          : undefined,
    });
  }

  const availableStrategies = strategies.filter((s) => s.available);
  const best =
    availableStrategies.length > 0
      ? availableStrategies.reduce((b, s) => (s.netMzn > b.netMzn ? s : b), availableStrategies[0])
      : null;

  return { bestAsk, bestBid, spreadAbsMzn, spreadPct, strategies, best };
}

export const FILL_RISK_LABEL: Record<FillRisk, string> = {
  baixo: "execução imediata",
  medio: "espera provável",
  alto: "espera longa possível",
};
