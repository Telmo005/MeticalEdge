/**
 * Cliente para a API pública (não documentada oficialmente, mas usada pelo
 * próprio site) do Binance P2P — porte directo de
 * p2p_mzn_analyzer/binance_client.py. Não requer autenticação.
 */
const SEARCH_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

export class BinanceP2PError extends Error {}

// Formato cru devolvido pela API — só os campos que a app usa.
export type RawAd = {
  adv: {
    advNo: string;
    tradeType: "BUY" | "SELL";
    price: string;
    surplusAmount?: string;
    tradableQuantity?: string;
    minSingleTransAmount: string;
    maxSingleTransAmount: string;
    dynamicMaxSingleTransAmount?: string;
    payTimeLimit?: number;
    tradeMethods?: { tradeMethodName?: string; payType?: string }[];
  };
  advertiser: {
    userNo: string;
    nickName: string;
    userType: string;
    monthOrderCount?: number;
    monthFinishRate?: number;
    positiveRate?: number;
  };
};

async function fetchPage(
  asset: string,
  fiat: string,
  tradeType: "BUY" | "SELL",
  page: number,
  rows = 20
): Promise<RawAd[]> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ asset, fiat, tradeType, page, rows, payTypes: [], publisherType: null }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new BinanceP2PError(`Binance P2P HTTP ${res.status}`);
  const body = await res.json();
  if (body.code !== "000000") throw new BinanceP2PError(`Binance P2P API retornou erro: ${JSON.stringify(body)}`);
  return body.data ?? [];
}

/**
 * Pagina até esgotar os anúncios (ou atingir maxPages).
 * tradeType="BUY"  -> eu quero COMPRAR o asset (retorna anúncios de quem VENDE)
 * tradeType="SELL" -> eu quero VENDER o asset (retorna anúncios de quem COMPRA)
 */
export async function fetchAllAds(
  asset: string,
  fiat: string,
  tradeType: "BUY" | "SELL",
  maxPages = 10,
  rows = 20
): Promise<RawAd[]> {
  const all: RawAd[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchPage(asset, fiat, tradeType, page, rows);
    if (batch.length === 0) break;
    let added = 0;
    for (const item of batch) {
      const advNo = item.adv?.advNo;
      if (advNo && !seen.has(advNo)) {
        seen.add(advNo);
        all.push(item);
        added++;
      }
    }
    if (batch.length < rows || added === 0) break;
  }
  return all;
}
