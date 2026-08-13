import "server-only";
import { gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { snapshots } from "@/db/schema";
import type { Ad } from "./orderbook";

/**
 * Dois motores de lucro que não olham para o livro de agora:
 *
 * 1. **Quando operar.** A app já guarda um snapshot por minuto há dias.
 *    Isso é um histórico real do mercado moçambicano, e ninguém o estava a
 *    usar para responder à pergunta mais prática de todas: "a que horas é
 *    que este mercado costuma estar bom?". Se o livro cruza sobretudo às
 *    20h, esperar por essa janela vale mais do que qualquer optimização de
 *    cêntimos.
 *
 * 2. **Por onde operar.** Nem todos os métodos de pagamento têm o mesmo
 *    preço. Quem só aceita transferência bancária costuma pagar melhor do
 *    que quem aceita M-Pesa (menos concorrência, mais fricção). Comprar por
 *    um método e vender por outro é uma margem que existe mesmo em livro
 *    normal — e que a análise por preço puro nunca mostra, porque mistura
 *    tudo no mesmo saco.
 */

const MAPUTO_TZ = "Africa/Maputo";

export type HourPattern = {
  /** 0–23, hora local de Maputo. */
  hour: number;
  samples: number;
  avgSpreadPct: number | null;
  avgBestAsk: number | null;
  avgBestBid: number | null;
  /** Fracção das varreduras nesta hora em que o livro estava cruzado. */
  crossedRate: number;
};

export type WeekdayPattern = {
  /** 0 = domingo. */
  weekday: number;
  label: string;
  samples: number;
  avgSpreadPct: number | null;
  crossedRate: number;
};

export type TimingInsight = {
  windowDays: number;
  totalSamples: number;
  hours: HourPattern[];
  weekdays: WeekdayPattern[];
  /** Hora com maior taxa de livro cruzado — a melhor janela para tentar. */
  bestHour: HourPattern | null;
  /** Hora em que o USDT esteve historicamente mais barato de comprar. */
  cheapestBuyHour: HourPattern | null;
  /** Hora em que se conseguiu historicamente vender mais caro. */
  richestSellHour: HourPattern | null;
  /** `false` enquanto não houver histórico suficiente para não enganar. */
  reliable: boolean;
};

const MIN_SAMPLES_PER_BUCKET = 10;
const MIN_TOTAL_SAMPLES = 300;

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function num(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/**
 * Agrupa o histórico já guardado por hora do dia e por dia da semana. Não
 * inventa previsão nenhuma — só conta o que aconteceu, e diz quantas
 * amostras suportam cada número, para o utilizador poder desconfiar
 * sozinho quando forem poucas.
 */
export async function getTimingInsight(windowDays = 30): Promise<TimingInsight> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const hourRows = await db
    .select({
      hour: sql<number>`extract(hour from ${snapshots.collectedAt} at time zone ${sql.raw(`'${MAPUTO_TZ}'`)})`,
      samples: sql<number>`count(*)`,
      avgSpreadPct: sql<string | null>`avg(${snapshots.spreadPct})`,
      avgBestAsk: sql<string | null>`avg(${snapshots.bestAsk})`,
      avgBestBid: sql<string | null>`avg(${snapshots.bestBid})`,
      crossed: sql<number>`count(*) filter (where ${snapshots.isCrossed})`,
    })
    .from(snapshots)
    .where(gte(snapshots.collectedAt, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const weekdayRows = await db
    .select({
      weekday: sql<number>`extract(dow from ${snapshots.collectedAt} at time zone ${sql.raw(`'${MAPUTO_TZ}'`)})`,
      samples: sql<number>`count(*)`,
      avgSpreadPct: sql<string | null>`avg(${snapshots.spreadPct})`,
      crossed: sql<number>`count(*) filter (where ${snapshots.isCrossed})`,
    })
    .from(snapshots)
    .where(gte(snapshots.collectedAt, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const hours: HourPattern[] = hourRows.map((r) => ({
    hour: Number(r.hour),
    samples: Number(r.samples),
    avgSpreadPct: num(r.avgSpreadPct),
    avgBestAsk: num(r.avgBestAsk),
    avgBestBid: num(r.avgBestBid),
    crossedRate: Number(r.samples) > 0 ? Number(r.crossed) / Number(r.samples) : 0,
  }));

  const weekdays: WeekdayPattern[] = weekdayRows.map((r) => ({
    weekday: Number(r.weekday),
    label: WEEKDAY_LABELS[Number(r.weekday)] ?? "?",
    samples: Number(r.samples),
    avgSpreadPct: num(r.avgSpreadPct),
    crossedRate: Number(r.samples) > 0 ? Number(r.crossed) / Number(r.samples) : 0,
  }));

  const totalSamples = hours.reduce((s, h) => s + h.samples, 0);
  const solid = hours.filter((h) => h.samples >= MIN_SAMPLES_PER_BUCKET);

  const bestHour =
    solid.length > 0 ? solid.reduce((b, h) => (h.crossedRate > b.crossedRate ? h : b), solid[0]) : null;

  const withAsk = solid.filter((h) => h.avgBestAsk !== null);
  const cheapestBuyHour =
    withAsk.length > 0
      ? withAsk.reduce((b, h) => ((h.avgBestAsk as number) < (b.avgBestAsk as number) ? h : b), withAsk[0])
      : null;

  const withBid = solid.filter((h) => h.avgBestBid !== null);
  const richestSellHour =
    withBid.length > 0
      ? withBid.reduce((b, h) => ((h.avgBestBid as number) > (b.avgBestBid as number) ? h : b), withBid[0])
      : null;

  return {
    windowDays,
    totalSamples,
    hours,
    weekdays,
    bestHour: bestHour && bestHour.crossedRate > 0 ? bestHour : null,
    cheapestBuyHour,
    richestSellHour,
    reliable: totalSamples >= MIN_TOTAL_SAMPLES,
  };
}

// ---------------------------------------------------------------------------
// Arbitragem entre métodos de pagamento
// ---------------------------------------------------------------------------

export type PayMethodSide = {
  method: string;
  nAds: number;
  bestPrice: number;
  /** Volume total disponível neste método, em MZN. */
  liquidityMzn: number;
  bestMerchant: string;
  bestAdvNo: string;
  bestMinMzn: number;
  bestMaxMzn: number;
  monthOrders: number | null;
  monthFinishRate: number | null;
};

export type PayMethodPair = {
  buyMethod: PayMethodSide;
  sellMethod: PayMethodSide;
  spreadAbsMzn: number;
  spreadPct: number;
  /** `true` quando comprar e vender usam o mesmo método — a comparação
   *  base contra a qual as combinações cruzadas se medem. */
  sameMethod: boolean;
};

export type PayMethodArbitrage = {
  buySides: PayMethodSide[];
  sellSides: PayMethodSide[];
  pairs: PayMethodPair[];
  /** A melhor combinação cruzada encontrada. */
  best: PayMethodPair | null;
  /** Quanto a melhor combinação cruzada ganha face a ficar no mesmo
   *  método — o valor real desta ideia, em pontos percentuais. */
  edgeOverSameMethodPct: number | null;
};

function bestByMethod(ads: Ad[], side: "buy" | "sell"): PayMethodSide[] {
  const byMethod = new Map<string, Ad[]>();
  for (const ad of ads) {
    if (ad.price <= 0) continue;
    const methods = ad.payMethods.length > 0 ? ad.payMethods : ["Outro"];
    for (const m of methods) {
      const list = byMethod.get(m);
      if (list) list.push(ad);
      else byMethod.set(m, [ad]);
    }
  }

  const out: PayMethodSide[] = [];
  for (const [method, list] of byMethod) {
    // "Melhor" depende do lado: a comprar queres o mais barato, a vender o
    // mais caro.
    const sorted = [...list].sort((a, b) => (side === "buy" ? a.price - b.price : b.price - a.price));
    const top = sorted[0];
    out.push({
      method,
      nAds: list.length,
      bestPrice: top.price,
      liquidityMzn: list.reduce((s, a) => s + a.surplusUsdt * a.price, 0),
      bestMerchant: top.merchantName,
      bestAdvNo: top.advNo,
      bestMinMzn: top.minMzn,
      bestMaxMzn: Math.min(
        ...[top.maxMznDeclared, top.maxMznDynamic, top.surplusUsdt * top.price].filter((v) => v > 0)
      ),
      monthOrders: top.monthOrders,
      monthFinishRate: top.monthFinishRate,
    });
  }

  return out.sort((a, b) => (side === "buy" ? a.bestPrice - b.bestPrice : b.bestPrice - a.bestPrice));
}

const MIN_ADS_PER_METHOD = 2;

/**
 * Cruza cada método de pagamento do lado da compra com cada método do lado
 * da venda. Métodos com muito poucos anúncios são ignorados: um único
 * anúncio esquisito com preço fora da realidade daria uma "oportunidade"
 * que desaparece assim que se tenta executar.
 */
export function analyzePayMethodArbitrage(askAds: Ad[], bidAds: Ad[]): PayMethodArbitrage {
  const buySides = bestByMethod(
    askAds.filter((a) => a.side === "SELL"),
    "buy"
  ).filter((s) => s.nAds >= MIN_ADS_PER_METHOD);

  const sellSides = bestByMethod(
    bidAds.filter((b) => b.side === "BUY"),
    "sell"
  ).filter((s) => s.nAds >= MIN_ADS_PER_METHOD);

  const pairs: PayMethodPair[] = [];
  for (const buyMethod of buySides) {
    for (const sellMethod of sellSides) {
      const spreadAbsMzn = sellMethod.bestPrice - buyMethod.bestPrice;
      pairs.push({
        buyMethod,
        sellMethod,
        spreadAbsMzn,
        spreadPct: buyMethod.bestPrice ? (spreadAbsMzn / buyMethod.bestPrice) * 100 : 0,
        sameMethod: buyMethod.method === sellMethod.method,
      });
    }
  }

  pairs.sort((a, b) => b.spreadPct - a.spreadPct);

  const crossPairs = pairs.filter((p) => !p.sameMethod);
  const samePairs = pairs.filter((p) => p.sameMethod);
  const best = crossPairs[0] ?? null;
  const bestSame = samePairs[0] ?? null;

  return {
    buySides,
    sellSides,
    pairs,
    best,
    edgeOverSameMethodPct: best && bestSame ? best.spreadPct - bestSame.spreadPct : null,
  };
}
