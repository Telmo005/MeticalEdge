/**
 * Cliente para a API pública (não documentada oficialmente para uso
 * server-to-server, mas confirmada live e sem autenticação — ver pesquisa
 * de 2026-08-14) do Bybit P2P. Mesmo padrão de lib/p2p/binance-client.ts.
 *
 * Convenção de `side` igual à do adaptador Binance: "BUY" = eu quero
 * COMPRAR o asset (peço os anúncios de quem VENDE). O endpoint do Bybit
 * espera side="0" para esse caso ("buy" tab do site) e side="1" para o
 * inverso ("sell" tab, anúncios de quem COMPRA) — confirmado contra os
 * docs oficiais do Bybit (side: 0=buy, 1=sell) e contra preços reais
 * observados (ask > bid nos pares testados).
 */
import type { GenericAd, P2PPlatformAdapter } from "./types";

const ITEM_LIST_URL = "https://api2.bybit.com/fiat/otc/item/online";

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Origin: "https://www.bybit.com",
  Accept: "application/json",
};

type BybitItem = {
  id: string;
  nickName: string;
  price: string;
  lastQuantity?: string;
  quantity?: string;
  minAmount: string;
  maxAmount: string;
  payments?: string[];
  orderNum?: number;
  recentOrderNum?: number;
  /** Escala 0-100 (não 0-1 como o monthFinishRate do Binance) — não é
   *  comparado directamente entre plataformas nesta fase. */
  recentExecuteRate?: number;
  isOnline?: boolean;
};

function toFloat(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

async function fetchPage(
  asset: string,
  fiat: string,
  bybitSide: "0" | "1",
  page: number,
  size = 20
): Promise<BybitItem[]> {
  const res = await fetch(ITEM_LIST_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      userId: "",
      tokenId: asset,
      currencyId: fiat,
      payment: [],
      side: bybitSide,
      size: String(size),
      page: String(page),
      amount: "",
      authMaker: false,
      canTrade: false,
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bybit P2P HTTP ${res.status}`);
  const body = await res.json();
  if (body.ret_code !== 0) throw new Error(`Bybit P2P API retornou erro: ${JSON.stringify(body)}`);
  return body.result?.items ?? [];
}

function normalize(item: BybitItem, advertiserSide: "BUY" | "SELL"): GenericAd {
  return {
    externalId: item.id,
    side: advertiserSide,
    price: toFloat(item.price),
    surplusAsset: toFloat(item.lastQuantity ?? item.quantity),
    minFiat: toFloat(item.minAmount),
    maxFiat: toFloat(item.maxAmount),
    payMethods: item.payments ?? [],
    merchantId: item.id,
    merchantName: item.nickName ?? "?",
    monthOrders: item.orderNum ?? item.recentOrderNum ?? null,
    monthFinishRate: item.recentExecuteRate ?? null,
    isOnline: item.isOnline,
  };
}

export const bybitP2PAdapter: P2PPlatformAdapter = {
  id: "bybit_p2p",
  label: "Bybit P2P",
  async fetchAds(asset, fiat, side) {
    // side="BUY" (eu quero comprar) -> bybitSide "0" -> devolve anúncios de
    // quem VENDE; side="SELL" -> bybitSide "1" -> devolve anúncios de quem
    // COMPRA. Ver nota de convenção no topo do ficheiro.
    const bybitSide: "0" | "1" = side === "BUY" ? "0" : "1";
    const advertiserSide: "BUY" | "SELL" = side === "BUY" ? "SELL" : "BUY";

    const maxPages = 3;
    const size = 20;
    const all: GenericAd[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= maxPages; page++) {
      const items = await fetchPage(asset, fiat, bybitSide, page, size);
      if (items.length === 0) break;
      let added = 0;
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          all.push(normalize(item, advertiserSide));
          added++;
        }
      }
      if (items.length < size || added === 0) break;
    }
    return all;
  },
};
