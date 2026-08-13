/**
 * Normalização dos anúncios crus da API e simulação de execução com
 * profundidade real de livro — porte directo de p2p_mzn_analyzer/orderbook.py.
 */
import type { RawAd } from "./binance-client";

export type Ad = {
  advNo: string;
  side: "BUY" | "SELL";
  price: number;
  surplusUsdt: number;
  minMzn: number;
  maxMznDeclared: number;
  maxMznDynamic: number;
  payMethods: string[];
  merchantId: string;
  merchantName: string;
  merchantType: string;
  monthOrders: number | null;
  monthFinishRate: number | null;
  positiveRate: number | null;
};

function toFloat(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Teto real executável nesse anúncio, em MZN. */
export function maxMznExecutable(ad: Ad): number {
  const candidates = [ad.maxMznDeclared, ad.maxMznDynamic, ad.surplusUsdt * ad.price].filter(
    (c) => c && c > 0
  );
  return candidates.length ? Math.min(...candidates) : 0;
}

export function normalizeAd(raw: RawAd): Ad {
  const adv = raw.adv;
  const advertiser = raw.advertiser;
  const price = toFloat(adv.price);
  const maxDeclared = toFloat(adv.maxSingleTransAmount);
  return {
    advNo: adv.advNo ?? "",
    side: adv.tradeType,
    price,
    surplusUsdt: toFloat(adv.surplusAmount ?? adv.tradableQuantity),
    minMzn: toFloat(adv.minSingleTransAmount),
    maxMznDeclared: maxDeclared,
    maxMznDynamic: toFloat(adv.dynamicMaxSingleTransAmount, maxDeclared),
    payMethods: (adv.tradeMethods ?? []).map((tm) => tm.tradeMethodName ?? tm.payType ?? "?"),
    merchantId: advertiser.userNo ?? "",
    merchantName: advertiser.nickName ?? "?",
    merchantType: advertiser.userType ?? "?",
    monthOrders: advertiser.monthOrderCount ?? null,
    monthFinishRate: advertiser.monthFinishRate ?? null,
    positiveRate: advertiser.positiveRate ?? null,
  };
}

export function normalizeAll(rawAds: RawAd[]): Ad[] {
  return rawAds.map(normalizeAd);
}

export type FillStep = {
  advNo: string;
  merchantName: string;
  merchantId: string;
  price: number;
  mznUsed: number;
  usdtAmount: number;
  monthOrders: number | null;
  monthFinishRate: number | null;
  /** Limites do anúncio em si (não desta operação) — quanto é preciso
   *  negociar no mínimo, e o máximo que este comerciante aceita de uma vez.
   *  Mostrado nos cards para explicar, sem cálculo nenhum, porque um preço
   *  óptimo às vezes não é usável (limite maior do que o capital). */
  minMzn: number;
  maxMzn: number;
};

export type ExecutionResult = {
  inputAmount: number; // MZN (compra) ou USDT (venda) que se tentou usar
  inputUsed: number; // quanto foi de facto utilizado
  outputAmount: number; // USDT recebido (compra) ou MZN recebido (venda)
  vwapPrice: number | null;
  steps: FillStep[];
  fullyFilled: boolean;
  limitingFactor: string | null;
};

/** Simula comprar USDT gastando `capitalMzn`, varrendo os anúncios de quem
 *  VENDE USDT (side === "SELL") do mais barato para o mais caro. */
export function simulateBuyUsdt(askAds: Ad[], capitalMzn: number): ExecutionResult {
  const pool = askAds.filter((a) => a.side === "SELL" && a.price > 0).sort((a, b) => a.price - b.price);
  let remaining = capitalMzn;
  const steps: FillStep[] = [];
  let usdtTotal = 0;
  for (const ad of pool) {
    if (remaining <= 0) break;
    const cap = maxMznExecutable(ad);
    if (cap <= 0) continue;
    if (ad.minMzn > remaining) continue;
    const use = Math.min(remaining, cap);
    if (use < ad.minMzn) continue;
    const usdt = use / ad.price;
    steps.push({
      advNo: ad.advNo, merchantName: ad.merchantName, merchantId: ad.merchantId,
      price: ad.price, mznUsed: use, usdtAmount: usdt,
      monthOrders: ad.monthOrders, monthFinishRate: ad.monthFinishRate,
      minMzn: ad.minMzn, maxMzn: cap,
    });
    usdtTotal += usdt;
    remaining -= use;
  }
  const used = capitalMzn - remaining;
  const vwap = usdtTotal > 0 ? used / usdtTotal : null;
  const limiting = remaining > 0.01 ? "liquidez/limites insuficientes para preencher 100% do capital" : null;
  return { inputAmount: capitalMzn, inputUsed: used, outputAmount: usdtTotal, vwapPrice: vwap, steps, fullyFilled: remaining <= 0.01, limitingFactor: limiting };
}

/** Simula vender `usdtAmount` de USDT, varrendo anúncios de quem COMPRA
 *  USDT (side === "BUY") do mais caro para o mais barato. */
export function simulateSellUsdt(bidAds: Ad[], usdtAmount: number): ExecutionResult {
  const pool = bidAds.filter((a) => a.side === "BUY" && a.price > 0).sort((a, b) => b.price - a.price);
  let remainingUsdt = usdtAmount;
  const steps: FillStep[] = [];
  let mznTotal = 0;
  for (const ad of pool) {
    if (remainingUsdt <= 0) break;
    const capMzn = maxMznExecutable(ad);
    const capUsdt = ad.price ? capMzn / ad.price : 0;
    if (capUsdt <= 0) continue;
    const minUsdt = ad.price ? ad.minMzn / ad.price : 0;
    if (minUsdt > remainingUsdt) continue;
    const useUsdt = Math.min(remainingUsdt, capUsdt);
    if (useUsdt < minUsdt) continue;
    const mzn = useUsdt * ad.price;
    steps.push({
      advNo: ad.advNo, merchantName: ad.merchantName, merchantId: ad.merchantId,
      price: ad.price, mznUsed: mzn, usdtAmount: useUsdt,
      monthOrders: ad.monthOrders, monthFinishRate: ad.monthFinishRate,
      minMzn: ad.minMzn, maxMzn: capMzn,
    });
    mznTotal += mzn;
    remainingUsdt -= useUsdt;
  }
  const usedUsdt = usdtAmount - remainingUsdt;
  const vwap = usedUsdt > 0 ? mznTotal / usedUsdt : null;
  const limiting = remainingUsdt > 0.0001 ? "liquidez/limites insuficientes para vender 100% do USDT" : null;
  return { inputAmount: usdtAmount, inputUsed: usedUsdt, outputAmount: mznTotal, vwapPrice: vwap, steps, fullyFilled: remainingUsdt <= 0.0001, limitingFactor: limiting };
}

/** Como simulateBuyUsdt, mas com um alvo em USDT em vez de um orçamento em
 *  MZN — usado pelo modo "equilibrado" quando é a capacidade de venda (não
 *  o capital) que decide quanto vale a pena comprar. Nunca gasta mais do
 *  que `maxMzn`. */
export function simulateBuyUsdtTarget(askAds: Ad[], targetUsdt: number, maxMzn: number): ExecutionResult {
  const pool = askAds.filter((a) => a.side === "SELL" && a.price > 0).sort((a, b) => a.price - b.price);
  let remainingUsdt = targetUsdt;
  let remainingMzn = maxMzn;
  const steps: FillStep[] = [];
  let mznTotal = 0;
  let usdtTotal = 0;
  for (const ad of pool) {
    if (remainingUsdt <= 0 || remainingMzn <= 0) break;
    const capMznAd = Math.min(maxMznExecutable(ad), remainingMzn);
    if (capMznAd <= 0) continue;
    if (ad.minMzn > capMznAd) continue;
    const capUsdtAd = capMznAd / ad.price;
    const useUsdt = Math.min(remainingUsdt, capUsdtAd);
    const useMzn = useUsdt * ad.price;
    if (useMzn < ad.minMzn) continue;
    steps.push({
      advNo: ad.advNo, merchantName: ad.merchantName, merchantId: ad.merchantId,
      price: ad.price, mznUsed: useMzn, usdtAmount: useUsdt,
      monthOrders: ad.monthOrders, monthFinishRate: ad.monthFinishRate,
      minMzn: ad.minMzn, maxMzn: maxMznExecutable(ad),
    });
    mznTotal += useMzn;
    usdtTotal += useUsdt;
    remainingUsdt -= useUsdt;
    remainingMzn -= useMzn;
  }
  const vwap = usdtTotal > 0 ? mznTotal / usdtTotal : null;
  const limiting = remainingUsdt > 0.0001 ? "liquidez/limites insuficientes para completar a compra alvo" : null;
  return { inputAmount: maxMzn, inputUsed: mznTotal, outputAmount: usdtTotal, vwapPrice: vwap, steps, fullyFilled: remainingUsdt <= 0.0001, limitingFactor: limiting };
}
