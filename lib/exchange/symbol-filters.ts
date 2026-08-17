import type { ExchangeInfo } from "@/lib/exchange/types";

export function stepSizeOf(info: ExchangeInfo, symbol: string): number {
  const sym = info.symbols.find((s) => s.symbol === symbol);
  const lot = sym?.filters.find((f) => f.type === "LOT_SIZE");
  return lot && lot.type === "LOT_SIZE" ? Number(lot.stepSize) : 0.00000001;
}

export function roundDownToStep(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.floor(value / step) * step;
}
