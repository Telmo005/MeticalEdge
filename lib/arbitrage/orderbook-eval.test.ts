import { describe, expect, it } from "vitest";
import { walkBuy, walkSell } from "@/lib/arbitrage/orderbook-eval";
import type { OrderBookDepth } from "@/lib/exchange/types";

const DEEP_BOOK: OrderBookDepth = {
  asks: [
    ["100.00", "1.0"],
    ["100.50", "1.0"],
    ["101.00", "5.0"],
  ],
  bids: [
    ["99.50", "1.0"],
    ["99.00", "1.0"],
    ["98.50", "5.0"],
  ],
};

describe("walkBuy", () => {
  it("preenche ao preço médio esperado quando há liquidez suficiente", () => {
    const result = walkBuy(DEEP_BOOK, 100, 0, true);
    expect(result.liquidityOk).toBe(true);
    expect(result.avgPrice).toBeCloseTo(100, 5);
    expect(result.assetQty).toBeCloseTo(1, 5);
  });

  it("consome vários níveis quando o primeiro não chega", () => {
    // 150 USDT: 100 no primeiro nível (1.0 @ 100) + 50 no segundo (0.5 @ 100.50)
    const result = walkBuy(DEEP_BOOK, 150, 0, true);
    expect(result.liquidityOk).toBe(true);
    expect(result.assetQty).toBeCloseTo(1.4975, 3);
  });

  it("aplica a taxa reduzindo a quantidade recebida", () => {
    const noFee = walkBuy(DEEP_BOOK, 100, 0, true);
    const withFee = walkBuy(DEEP_BOOK, 100, 1, true); // 1%
    expect(withFee.assetQty).toBeCloseTo(noFee.assetQty * 0.99, 6);
  });

  it("assinala liquidez insuficiente quando o livro não tem profundidade para o montante pedido", () => {
    const result = walkBuy(DEEP_BOOK, 1_000_000, 0, true);
    expect(result.liquidityOk).toBe(false);
  });

  it("livro vazio nunca é tratado como liquidez válida", () => {
    const result = walkBuy({ asks: [], bids: [] }, 100, 0, true);
    expect(result).toEqual({ assetQty: 0, avgPrice: 0, liquidityOk: false });
  });

  it("regressão: níveis corrompidos (preço/quantidade não numéricos) são filtrados, nunca produzem NaN", () => {
    const corrupted: OrderBookDepth = {
      asks: [
        ["abc", "1.0"],
        ["", "1.0"],
        ["100.00", "not-a-number"],
        ["-5", "1.0"],
        ["0", "1.0"],
        ["100.00", "1.0"],
      ],
      bids: DEEP_BOOK.bids,
    };
    const result = walkBuy(corrupted, 100, 0, true);
    expect(Number.isFinite(result.assetQty)).toBe(true);
    expect(Number.isFinite(result.avgPrice)).toBe(true);
    expect(result.liquidityOk).toBe(true);
    expect(result.avgPrice).toBeCloseTo(100, 5);
  });
});

describe("walkSell", () => {
  it("preenche ao preço médio esperado quando há liquidez suficiente", () => {
    const result = walkSell(DEEP_BOOK, 1, 0, true);
    expect(result.liquidityOk).toBe(true);
    expect(result.avgPrice).toBeCloseTo(99.5, 5);
    expect(result.usdtOut).toBeCloseTo(99.5, 5);
  });

  it("aplica a taxa reduzindo o USDT recebido", () => {
    const noFee = walkSell(DEEP_BOOK, 1, 0, true);
    const withFee = walkSell(DEEP_BOOK, 1, 1, true);
    expect(withFee.usdtOut).toBeCloseTo(noFee.usdtOut * 0.99, 6);
  });

  it("regressão: níveis corrompidos são filtrados, nunca produzem NaN", () => {
    const corrupted: OrderBookDepth = {
      bids: [
        ["NaN", "1.0"],
        ["99.50", "Infinity"],
        ["99.50", "1.0"],
      ],
      asks: DEEP_BOOK.asks,
    };
    const result = walkSell(corrupted, 1, 0, true);
    expect(Number.isFinite(result.usdtOut)).toBe(true);
    expect(Number.isFinite(result.avgPrice)).toBe(true);
  });
});
