/**
 * Adaptador do módulo internacional para lib/p2p/binance-client.ts, que já
 * existe e já é genérico por `fiat` — sem reescrever chamadas à API.
 */
import { fetchAllAds, type RawAd } from "@/lib/p2p/binance-client";
import type { GenericAd, P2PPlatformAdapter } from "./types";

function toFloat(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function normalize(raw: RawAd): GenericAd {
  const adv = raw.adv;
  const advertiser = raw.advertiser;
  const maxDeclared = toFloat(adv.maxSingleTransAmount);
  return {
    externalId: adv.advNo ?? "",
    side: adv.tradeType,
    price: toFloat(adv.price),
    surplusAsset: toFloat(adv.surplusAmount ?? adv.tradableQuantity),
    minFiat: toFloat(adv.minSingleTransAmount),
    maxFiat: toFloat(adv.dynamicMaxSingleTransAmount, maxDeclared) || maxDeclared,
    payMethods: (adv.tradeMethods ?? []).map((tm) => tm.tradeMethodName ?? tm.payType ?? "?"),
    merchantId: advertiser.userNo ?? "",
    merchantName: advertiser.nickName ?? "?",
    monthOrders: advertiser.monthOrderCount ?? null,
    monthFinishRate: advertiser.monthFinishRate ?? null,
  };
}

export const binanceP2PAdapter: P2PPlatformAdapter = {
  id: "binance_p2p",
  label: "Binance P2P",
  async fetchAds(asset, fiat, side) {
    // maxPages=3 (não os 10 por omissão) — com 10 pares no scan
    // internacional, profundidade total do livro adicionaria latência sem
    // ajudar: só precisamos do melhor preço, não da liquidez inteira.
    const raw = await fetchAllAds(asset, fiat, side, 3, 20);
    return raw.map(normalize);
  },
};
