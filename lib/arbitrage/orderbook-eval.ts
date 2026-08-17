import type { OrderBookDepth } from "@/lib/exchange/types";

export type WalkResult = {
  /** Preço médio efectivo conseguido, antes de taxas. */
  avgPrice: number;
  liquidityOk: boolean;
};

export type WalkBuyResult = WalkResult & { assetQty: number };
export type WalkSellResult = WalkResult & { usdtOut: number };

/** Descarta níveis com preço/quantidade não numéricos ou não positivos —
 *  dados de mercado ocasionalmente vêm com entradas corrompidas ou
 *  transitórias (secção 3 do desenho original: "protecção contra dados
 *  inconsistentes"), e um único nível inválido não pode envenenar todo o
 *  cálculo de preço médio. */
function cleanLevels(levels: [string, string][]): [number, number][] {
  return levels
    .map(([priceStr, qtyStr]) => [Number(priceStr), Number(qtyStr)] as [number, number])
    .filter(([price, qty]) => Number.isFinite(price) && price > 0 && Number.isFinite(qty) && qty > 0);
}

/** Consome os "asks" (ordenados do preço mais baixo para o mais alto) para
 *  gastar `usdtIn` USDT a comprar o activo. `useDepth=false` usa só o
 *  melhor preço (linha de base "ideal", sem slippage, para isolar o custo
 *  de profundidade do custo de taxas — secção 20). */
export function walkBuy(book: OrderBookDepth, usdtIn: number, feePct: number, useDepth = true): WalkBuyResult {
  const asks = cleanLevels(book.asks).sort((a, b) => a[0] - b[0]);
  if (asks.length === 0 || !Number.isFinite(usdtIn) || usdtIn <= 0) {
    return { assetQty: 0, avgPrice: 0, liquidityOk: false };
  }

  if (!useDepth) {
    const bestPrice = asks[0][0];
    const grossQty = usdtIn / bestPrice;
    return { assetQty: grossQty * (1 - feePct / 100), avgPrice: bestPrice, liquidityOk: true };
  }

  let remainingUsdt = usdtIn;
  let grossQty = 0;
  for (const [price, levelQty] of asks) {
    if (remainingUsdt <= 0) break;
    const levelValueUsdt = price * levelQty;

    if (remainingUsdt <= levelValueUsdt) {
      grossQty += remainingUsdt / price;
      remainingUsdt = 0;
      break;
    }
    grossQty += levelQty;
    remainingUsdt -= levelValueUsdt;
  }

  const liquidityOk = remainingUsdt <= 0;
  const spentUsdt = usdtIn - remainingUsdt;
  const avgPrice = grossQty > 0 ? spentUsdt / grossQty : 0;
  return { assetQty: grossQty * (1 - feePct / 100), avgPrice, liquidityOk };
}

/** Consome os "bids" (ordenados do preço mais alto para o mais baixo) para
 *  vender `assetQtyIn` unidades do activo. */
export function walkSell(book: OrderBookDepth, assetQtyIn: number, feePct: number, useDepth = true): WalkSellResult {
  const bids = cleanLevels(book.bids).sort((a, b) => b[0] - a[0]);
  if (bids.length === 0 || !Number.isFinite(assetQtyIn) || assetQtyIn <= 0) {
    return { usdtOut: 0, avgPrice: 0, liquidityOk: false };
  }

  if (!useDepth) {
    const bestPrice = bids[0][0];
    const grossUsdt = assetQtyIn * bestPrice;
    return { usdtOut: grossUsdt * (1 - feePct / 100), avgPrice: bestPrice, liquidityOk: true };
  }

  let remainingQty = assetQtyIn;
  let grossUsdt = 0;
  for (const [price, levelQty] of bids) {
    if (remainingQty <= 0) break;

    if (remainingQty <= levelQty) {
      grossUsdt += remainingQty * price;
      remainingQty = 0;
      break;
    }
    grossUsdt += levelQty * price;
    remainingQty -= levelQty;
  }

  const liquidityOk = remainingQty <= 0;
  const soldQty = assetQtyIn - remainingQty;
  const avgPrice = soldQty > 0 ? grossUsdt / soldQty : 0;
  return { usdtOut: grossUsdt * (1 - feePct / 100), avgPrice, liquidityOk };
}
