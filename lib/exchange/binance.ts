import { createHmac } from "node:crypto";
import type {
  AccountBalance,
  CommissionRates,
  ExchangeAdapter,
  ExchangeInfo,
  OrderBookDepth,
  OrderResult,
  PlaceMarketOrderParams,
  SymbolFilter,
} from "@/lib/exchange/types";
import { ExchangeApiError } from "@/lib/exchange/types";

const BASE_URL = "https://api.binance.com";
const REQUEST_TIMEOUT_MS = 10_000;

function hasCredentials(): boolean {
  return Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
}

function sign(query: string): string {
  const secret = process.env.BINANCE_API_SECRET;
  if (!secret) throw new ExchangeApiError("BINANCE_API_SECRET não configurada");
  return createHmac("sha256", secret).update(query).digest("hex");
}

async function request<T>(
  path: string,
  { method = "GET", params, signed = false }: { method?: string; params?: Record<string, string>; signed?: boolean } = {},
): Promise<T> {
  const query = new URLSearchParams(params ?? {});
  if (signed) {
    const apiKey = process.env.BINANCE_API_KEY;
    if (!apiKey) throw new ExchangeApiError("BINANCE_API_KEY não configurada");
    query.set("timestamp", String(Date.now()));
    query.set("recvWindow", "5000");
    query.set("signature", sign(query.toString()));
  }

  const url = `${BASE_URL}${path}${query.toString() ? `?${query.toString()}` : ""}`;
  const headers: Record<string, string> = {};
  if (signed) headers["X-MBX-APIKEY"] = process.env.BINANCE_API_KEY!;

  const res = await fetch(url, {
    method,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ExchangeApiError(
      `Binance ${method} ${path} falhou: ${res.status}`,
      res.status,
      body,
    );
  }
  return body as T;
}

async function getOrderBookDepth(symbol: string, limit = 100): Promise<OrderBookDepth> {
  return request<OrderBookDepth>("/api/v3/depth", { params: { symbol, limit: String(limit) } });
}

async function getExchangeInfo(): Promise<ExchangeInfo> {
  const raw = await request<{
    symbols: { symbol: string; baseAsset: string; quoteAsset: string; status: string; filters: Record<string, string>[] }[];
  }>("/api/v3/exchangeInfo");

  return {
    symbols: raw.symbols.map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      status: s.status,
      filters: s.filters.map((f) => f as unknown as SymbolFilter),
    })),
  };
}

async function getAccountBalances(): Promise<AccountBalance[]> {
  const raw = await request<{ balances: AccountBalance[] }>("/api/v3/account", { signed: true });
  return raw.balances.filter((b) => Number(b.free) > 0 || Number(b.locked) > 0);
}

async function getCommissionRates(symbol: string): Promise<CommissionRates> {
  // Resposta real de /api/v3/account/commission é aninhada
  // ({ standardCommission: { taker, maker, ... }, taxCommission: {...},
  // discount: {...} }) — não um "takerCommission" plano.
  const raw = await request<{ standardCommission: { taker: string } }>("/api/v3/account/commission", {
    params: { symbol },
    signed: true,
  });
  const takerFeePct = Number(raw.standardCommission?.taker) * 100;
  if (!Number.isFinite(takerFeePct)) {
    throw new ExchangeApiError(`Binance: taxa taker inválida na resposta para ${symbol}`);
  }
  return { takerFeePct };
}

async function placeMarketOrder(params: PlaceMarketOrderParams): Promise<OrderResult> {
  const body: Record<string, string> = {
    symbol: params.symbol,
    side: params.side,
    type: "MARKET",
  };
  if (params.quantity) body.quantity = params.quantity;
  if (params.quoteOrderQty) body.quoteOrderQty = params.quoteOrderQty;
  if (params.clientOrderId) body.newClientOrderId = params.clientOrderId;

  return request<OrderResult>("/api/v3/order", { method: "POST", params: body, signed: true });
}

async function getOrder(symbol: string, orderId: string): Promise<OrderResult> {
  return request<OrderResult>("/api/v3/order", { params: { symbol, orderId }, signed: true });
}

async function getOrderByClientId(symbol: string, clientOrderId: string): Promise<OrderResult | null> {
  try {
    return await request<OrderResult>("/api/v3/order", {
      params: { symbol, origClientOrderId: clientOrderId },
      signed: true,
    });
  } catch (err) {
    // -2013 "Order does not exist" — a exchange nunca recebeu esta ordem,
    // distinto de qualquer outro erro (rede, auth, etc.) que deve continuar
    // a propagar-se.
    if (err instanceof ExchangeApiError && (err.body as { code?: number } | undefined)?.code === -2013) {
      return null;
    }
    throw err;
  }
}

export const binanceAdapter: ExchangeAdapter = {
  id: "binance",
  hasCredentials,
  getOrderBookDepth,
  getExchangeInfo,
  getAccountBalances,
  getCommissionRates,
  placeMarketOrder,
  getOrder,
  getOrderByClientId,
};
