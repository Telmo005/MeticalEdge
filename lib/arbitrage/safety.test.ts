import { describe, expect, it } from "vitest";
import { checkRebalanceRecommended, computeTradeSizeUsdt, isWithinDailyLossLimit } from "@/lib/arbitrage/safety";

describe("computeTradeSizeUsdt", () => {
  it("usa a percentagem do saldo quando fica abaixo do tecto absoluto", () => {
    expect(computeTradeSizeUsdt(100, 10, 50)).toBe(10); // 10% de 100 = 10, abaixo do tecto de 50
  });

  it("nunca ultrapassa o tecto absoluto mesmo que a percentagem dê mais", () => {
    expect(computeTradeSizeUsdt(1000, 50, 5)).toBe(5); // 50% de 1000 = 500, capado a 5
  });

  it("nunca ultrapassa o saldo disponível", () => {
    expect(computeTradeSizeUsdt(3, 100, 1000)).toBe(3);
  });

  it("nunca é negativo mesmo com saldo zero ou negativo", () => {
    expect(computeTradeSizeUsdt(0, 10, 50)).toBe(0);
    expect(computeTradeSizeUsdt(-5, 10, 50)).toBe(0);
  });
});

describe("isWithinDailyLossLimit", () => {
  it("está dentro do limite quando o resultado do dia é positivo", () => {
    expect(isWithinDailyLossLimit(5, 10)).toBe(true);
  });

  it("está dentro do limite mesmo com perda, se ainda não atingiu o tecto", () => {
    expect(isWithinDailyLossLimit(-5, 10)).toBe(true);
  });

  it("deixa de estar dentro do limite exactamente no tecto (fronteira exclusiva)", () => {
    expect(isWithinDailyLossLimit(-10, 10)).toBe(false);
  });

  it("está fora do limite quando a perda ultrapassa o tecto", () => {
    expect(isWithinDailyLossLimit(-15, 10)).toBe(false);
  });
});

describe("checkRebalanceRecommended", () => {
  it("não recomenda quando as duas exchanges estão equilibradas", () => {
    const result = checkRebalanceRecommended({ binance: 10, bybit: 10 });
    expect(result.recommended).toBe(false);
  });

  it("não recomenda com um desvio pequeno, abaixo do limiar de 30%", () => {
    const result = checkRebalanceRecommended({ binance: 11, bybit: 9 }); // 10% de desvio
    expect(result.recommended).toBe(false);
  });

  it("recomenda quando uma exchange tem muito mais capital do que a outra", () => {
    const result = checkRebalanceRecommended({ binance: 18, bybit: 2 });
    expect(result.recommended).toBe(true);
    expect(result.reason).toContain("binance");
  });

  it("não recomenda quando o total é zero (nada para reequilibrar)", () => {
    const result = checkRebalanceRecommended({ binance: 0, bybit: 0 });
    expect(result.recommended).toBe(false);
  });
});
