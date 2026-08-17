import { describe, expect, it } from "vitest";
import { evaluateOpportunity } from "@/lib/arbitrage/opportunity-engine";
import type { OrderBookDepth } from "@/lib/exchange/types";

const CHEAP_BUY_BOOK: OrderBookDepth = {
  asks: [["100.00", "10.0"], ["100.10", "10.0"]],
  bids: [["99.90", "10.0"]],
};
const EXPENSIVE_SELL_BOOK: OrderBookDepth = {
  asks: [["102.10", "10.0"]],
  bids: [["102.00", "10.0"], ["101.90", "10.0"]],
};

const BASE_PARAMS = {
  pair: "BTCUSDT",
  buyExchange: "binance" as const,
  sellExchange: "bybit" as const,
  capitalUsdt: 100,
  buyBook: CHEAP_BUY_BOOK,
  sellBook: EXPENSIVE_SELL_BOOK,
  buyFeePct: 0.1,
  sellFeePct: 0.1,
  sellExchangeAssetAvailable: 10,
  minProfitPct: 0.1,
  minSafetyMarginPct: 0.15,
};

describe("evaluateOpportunity", () => {
  it("aprova uma oportunidade com spread suficiente para cobrir taxas e margem", () => {
    const result = evaluateOpportunity(BASE_PARAMS);
    expect(result.passedFilters).toBe(true);
    expect(result.rejectReasons).toEqual([]);
    expect(result.netPct).toBeGreaterThan(0.25); // minProfitPct + minSafetyMarginPct
    expect(result.liquidityOk).toBe(true);
  });

  it("rejeita quando a margem líquida fica abaixo do mínimo exigido", () => {
    const tightBook: OrderBookDepth = {
      asks: [["100.00", "10.0"]],
      bids: [["100.05", "10.0"]], // spread quase nulo, não cobre 0.2% de taxas + margem
    };
    const result = evaluateOpportunity({ ...BASE_PARAMS, sellBook: tightBook });
    expect(result.passedFilters).toBe(false);
    expect(result.rejectReasons.some((r) => r.includes("margem líquida"))).toBe(true);
  });

  it("rejeita por inventário insuficiente na exchange vendedora, mesmo sendo lucrativo", () => {
    const result = evaluateOpportunity({ ...BASE_PARAMS, sellExchangeAssetAvailable: 0 });
    expect(result.passedFilters).toBe(false);
    expect(result.rejectReasons.some((r) => r.includes("inventário insuficiente"))).toBe(true);
  });

  it("rejeita por liquidez insuficiente quando o capital excede a profundidade do livro", () => {
    const result = evaluateOpportunity({ ...BASE_PARAMS, capitalUsdt: 10_000_000 });
    expect(result.passedFilters).toBe(false);
    expect(result.liquidityOk).toBe(false);
    expect(result.rejectReasons.some((r) => r.includes("liquidez"))).toBe(true);
  });

  it("regressão: uma taxa NaN (ex. resposta de API mal interpretada) nunca produz uma oportunidade válida", () => {
    const result = evaluateOpportunity({ ...BASE_PARAMS, buyFeePct: NaN });
    expect(result.passedFilters).toBe(false);
    expect(result.rejectReasons.some((r) => r.includes("dados de mercado inconsistentes"))).toBe(true);
    // todos os campos numéricos guardados na base de dados têm de ficar finitos, nunca NaN/Infinity
    expect(Number.isFinite(result.buyPrice)).toBe(true);
    expect(Number.isFinite(result.sellPrice)).toBe(true);
    expect(Number.isFinite(result.quantity)).toBe(true);
    expect(Number.isFinite(result.netResultUsdt)).toBe(true);
    expect(Number.isFinite(result.netPct)).toBe(true);
    expect(Number.isFinite(result.grossSpreadPct)).toBe(true);
    expect(Number.isFinite(result.estimatedSlippagePct)).toBe(true);
  });
});
