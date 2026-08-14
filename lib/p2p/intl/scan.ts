/**
 * Varredura de arbitragem P2P internacional — Fase 1 (validação de
 * mercado). Para cada par em TARGET_PAIRS com `platformSell` já
 * configurado, busca o livro de anúncios das DUAS plataformas e testa as
 * DUAS direcções possíveis (comprar em A vender em B, e comprar em B vender
 * em A) — os preços flutuam independentemente em cada plataforma, por isso
 * testar só uma direcção sub-reportaria oportunidades reais que existissem
 * só na direcção inversa, o que enviesaria exactamente a decisão que a
 * Fase 1 existe para validar. Cada direcção viável gera a sua própria
 * linha em `intl_opportunities`.
 */
import { db } from "@/db";
import { intlOpportunities } from "@/db/schema";
import { CAPITAL_USD, DEFAULT_COSTS_PCT, MIN_NET_PCT_VIABLE, TARGET_PAIRS, type PairConfig } from "./pairs-config";
import { calculateOpportunity } from "./spread";
import type { GenericAd, P2PPlatformAdapter } from "./types";

export type IntlScanResult = {
  pair: string;
  skipped?: string;
  direction?: string;
  isViable?: boolean;
  spreadNetPct?: number;
};

/**
 * Preço do 2º melhor anúncio (não o 1º) entre os online — mercados finos
 * (visto ao vivo em Bybit KES/PEN) têm anúncios genuinamente online mas com
 * `maxFiat` tão baixo (ex: ~135 USD equivalente) que não representam
 * liquidez negociável a sério; um único anúncio desses no topo do livro
 * infla o spread para 15-20% de forma enganadora. Usar o 2º melhor é um
 * filtro anti-outlier simples e sem depender de conversão FX para medir
 * liquidez mínima em USD.
 */
function bestPrice(ads: GenericAd[], side: "SELL" | "BUY", pick: "min" | "max"): number | null {
  const prices = ads
    .filter((a) => a.side === side && a.price > 0 && a.isOnline !== false)
    .map((a) => a.price)
    .sort((a, b) => (pick === "min" ? a - b : b - a));
  if (prices.length === 0) return null;
  return prices.length >= 2 ? prices[1] : prices[0];
}

async function recordDirection(
  cfg: PairConfig,
  platformBuy: P2PPlatformAdapter,
  askAds: GenericAd[],
  platformSell: P2PPlatformAdapter,
  bidAds: GenericAd[]
): Promise<IntlScanResult> {
  const direction = `${platformBuy.id}→${platformSell.id}`;
  const bestAsk = bestPrice(askAds, "SELL", "min");
  const bestBid = bestPrice(bidAds, "BUY", "max");

  if (bestAsk === null || bestBid === null) {
    return { pair: cfg.pairLabel, direction, skipped: "sem anúncios de um dos lados" };
  }

  const opp = calculateOpportunity(bestAsk, bestBid, DEFAULT_COSTS_PCT, MIN_NET_PCT_VIABLE);
  const profitAtCapitalUsd = (CAPITAL_USD * opp.spreadNetPct) / 100;

  await db.insert(intlOpportunities).values({
    pair: cfg.pairLabel,
    region: cfg.region,
    platformBuy: platformBuy.id,
    platformSell: platformSell.id,
    bestAsk: bestAsk.toFixed(4),
    bestBid: bestBid.toFixed(4),
    spreadGrossPct: opp.spreadGrossPct.toFixed(4),
    spreadNetPct: opp.spreadNetPct.toFixed(4),
    capitalUsd: CAPITAL_USD.toFixed(2),
    profitAtCapitalUsd: profitAtCapitalUsd.toFixed(2),
    isViable: opp.isViable,
    nAdsBuy: askAds.length,
    nAdsSell: bidAds.length,
    raw: { topAsk: askAds.slice(0, 10), topBid: bidAds.slice(0, 10) },
  });

  return { pair: cfg.pairLabel, direction, isViable: opp.isViable, spreadNetPct: opp.spreadNetPct };
}

async function scanPair(cfg: PairConfig): Promise<IntlScanResult[]> {
  if (!cfg.platformSell) {
    return [{ pair: cfg.pairLabel, skipped: "platformSell não configurado" }];
  }
  const platformA = cfg.platformBuy;
  const platformB = cfg.platformSell;

  const [asksA, bidsA, asksB, bidsB] = await Promise.all([
    platformA.fetchAds(cfg.asset, cfg.fiat, "BUY"), // side="SELL" nos anúncios
    platformA.fetchAds(cfg.asset, cfg.fiat, "SELL"), // side="BUY" nos anúncios
    platformB.fetchAds(cfg.asset, cfg.fiat, "BUY"),
    platformB.fetchAds(cfg.asset, cfg.fiat, "SELL"),
  ]);

  return Promise.all([
    recordDirection(cfg, platformA, asksA, platformB, bidsB),
    recordDirection(cfg, platformB, asksB, platformA, bidsA),
  ]);
}

export async function runIntlArbitrageScan(): Promise<IntlScanResult[]> {
  const results: IntlScanResult[] = [];
  for (const cfg of TARGET_PAIRS) {
    try {
      results.push(...(await scanPair(cfg)));
    } catch (err) {
      results.push({ pair: cfg.pairLabel, skipped: err instanceof Error ? err.message : "erro desconhecido" });
    }
  }
  return results;
}
