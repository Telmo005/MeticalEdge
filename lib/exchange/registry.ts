import type { ExchangeAdapter, ExchangeId } from "@/lib/exchange/types";
import { binanceAdapter } from "@/lib/exchange/binance";
import { bybitAdapter } from "@/lib/exchange/bybit";

export const EXCHANGES: Record<ExchangeId, ExchangeAdapter> = {
  binance: binanceAdapter,
  bybit: bybitAdapter,
};

export const EXCHANGE_IDS: ExchangeId[] = ["binance", "bybit"];

export function otherExchange(id: ExchangeId): ExchangeId {
  return id === "binance" ? "bybit" : "binance";
}
