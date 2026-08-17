import { describe, expect, it } from "vitest";
import { roundDownToStep, stepSizeOf } from "@/lib/exchange/symbol-filters";
import type { ExchangeInfo } from "@/lib/exchange/types";

describe("roundDownToStep", () => {
  it("arredonda para baixo ao múltiplo do step size", () => {
    expect(roundDownToStep(1.23456789, 0.0001)).toBeCloseTo(1.2345, 8);
  });

  it("não altera um valor já exacto no step size", () => {
    expect(roundDownToStep(1.5, 0.5)).toBeCloseTo(1.5, 8);
  });

  it("nunca arredonda para cima, mesmo perto do limite seguinte", () => {
    expect(roundDownToStep(1.9999, 1)).toBe(1);
  });

  it("devolve o valor original quando o step é zero, negativo ou inválido", () => {
    expect(roundDownToStep(1.23456, 0)).toBe(1.23456);
    expect(roundDownToStep(1.23456, -1)).toBe(1.23456);
    expect(roundDownToStep(1.23456, NaN)).toBe(1.23456);
  });
});

describe("stepSizeOf", () => {
  const info: ExchangeInfo = {
    symbols: [
      {
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        status: "TRADING",
        filters: [{ type: "LOT_SIZE", minQty: "0.00001", maxQty: "9000", stepSize: "0.00001" }],
      },
    ],
  };

  it("devolve o stepSize do filtro LOT_SIZE do símbolo", () => {
    expect(stepSizeOf(info, "BTCUSDT")).toBeCloseTo(0.00001, 8);
  });

  it("cai para um valor por omissão minúsculo quando o símbolo não é conhecido", () => {
    expect(stepSizeOf(info, "DOGEUSDT")).toBeCloseTo(0.00000001, 10);
  });
});
