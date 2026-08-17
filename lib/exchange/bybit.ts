import { createHmac } from "node:crypto";
import type {
  AccountBalance,
  CommissionRates,
  ExchangeAdapter,
  ExchangeInfo,
  OrderBookDepth,
  OrderResult,
  PlaceMarketOrderParams,
} from "@/lib/exchange/types";
import { ExchangeApiError } from "@/lib/exchange/types";

const BASE_URL = "https://api.bybit.com";
const REQUEST_TIMEOUT_MS = 10_000;
const RECV_WINDOW = "5000";

function hasCredentials(): boolean {
  return Boolean(process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET);
}

/** Assinatura V5: HMAC-SHA256 de `timestamp + apiKey + recvWindow + payload`
 *  (payload = query string em GET, corpo JSON em POST) — ver
 *  https://bybit-exchange.github.io/docs/v5/guide#authentication. */
function sign(timestamp: string, payload: string): string {
  const secret = process.env.BYBIT_API_SECRET;
  if (!secret) throw new ExchangeApiError("BYBIT_API_SECRET não configurada");
  const apiKey = process.env.BYBIT_API_KEY;
  return createHmac("sha256", secret).update(`${timestamp}${apiKey}${RECV_WINDOW}${payload}`).digest("hex");
}

async function request<T>(
  path: string,
  { method = "GET", params, body, signed = false }: {
    method?: string;
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    signed?: boolean;
  } = {},
): Promise<T> {
  const query = new URLSearchParams(params ?? {});
  const queryString = query.toString();
  const bodyString = body ? JSON.stringify(body) : "";
  const url = `${BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signed) {
    const apiKey = process.env.BYBIT_API_KEY;
    if (!apiKey) throw new ExchangeApiError("BYBIT_API_KEY não configurada");
    const timestamp = String(Date.now());
    const payload = method === "GET" ? queryString : bodyString;
    headers["X-BAPI-API-KEY"] = apiKey;
    headers["X-BAPI-TIMESTAMP"] = timestamp;
    headers["X-BAPI-RECV-WINDOW"] = RECV_WINDOW;
    headers["X-BAPI-SIGN"] = sign(timestamp, payload);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : bodyString,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.retCode !== 0) {
    throw new ExchangeApiError(
      `Bybit ${method} ${path} falhou: ${res.status} ${json?.retMsg ?? ""}`,
      res.status,
      json,
    );
  }
  return json.result as T;
}

async function getOrderBookDepth(symbol: string, limit = 100): Promise<OrderBookDepth> {
  const result = await request<{ b: [string, string][]; a: [string, string][] }>("/v5/market/orderbook", {
    params: { category: "spot", symbol, limit: String(Math.min(limit, 200)) },
  });
  return { bids: result.b, asks: result.a };
}

async function getExchangeInfo(): Promise<ExchangeInfo> {
  const result = await request<{
    list: {
      symbol: string;
      baseCoin: string;
      quoteCoin: string;
      status: string;
      lotSizeFilter: { basePrecision: string; minOrderQty: string; maxOrderQty: string; minOrderAmt: string; maxOrderAmt: string };
      priceFilter: { tickSize: string };
    }[];
  }>("/v5/market/instruments-info", { params: { category: "spot" } });

  return {
    symbols: result.list.map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseCoin,
      quoteAsset: s.quoteCoin,
      status: s.status,
      filters: [
        { type: "LOT_SIZE", minQty: s.lotSizeFilter.minOrderQty, maxQty: s.lotSizeFilter.maxOrderQty, stepSize: s.lotSizeFilter.basePrecision },
        { type: "PRICE_FILTER", minPrice: "0", maxPrice: "0", tickSize: s.priceFilter.tickSize },
        { type: "NOTIONAL", minNotional: s.lotSizeFilter.minOrderAmt },
      ],
    })),
  };
}

async function getAccountBalances(): Promise<AccountBalance[]> {
  const result = await request<{
    list: { coin: { coin: string; walletBalance: string; locked: string }[] }[];
  }>("/v5/account/wallet-balance", { params: { accountType: "UNIFIED" }, signed: true });

  const coins = result.list[0]?.coin ?? [];
  return coins
    .map((c) => ({
      asset: c.coin,
      free: String(Math.max(0, Number(c.walletBalance) - Number(c.locked || "0"))),
      locked: c.locked || "0",
    }))
    .filter((b) => Number(b.free) > 0 || Number(b.locked) > 0);
}

async function getCommissionRates(symbol: string): Promise<CommissionRates> {
  const result = await request<{ list: { takerFeeRate: string }[] }>("/v5/account/fee-rate", {
    params: { category: "spot", symbol },
    signed: true,
  });
  const rate = result.list[0]?.takerFeeRate ?? "0.001";
  const takerFeePct = Number(rate) * 100;
  if (!Number.isFinite(takerFeePct)) {
    throw new ExchangeApiError(`Bybit: taxa taker inválida na resposta para ${symbol}`);
  }
  return { takerFeePct };
}

async function placeMarketOrder(params: PlaceMarketOrderParams): Promise<OrderResult> {
  const side = params.side === "BUY" ? "Buy" : "Sell";
  const body: Record<string, unknown> = {
    category: "spot",
    symbol: params.symbol,
    side,
    orderType: "Market",
  };
  if (params.quoteOrderQty) {
    body.qty = params.quoteOrderQty;
    body.marketUnit = "quoteCoin";
  } else if (params.quantity) {
    body.qty = params.quantity;
    body.marketUnit = "baseCoin";
  }
  if (params.clientOrderId) body.orderLinkId = params.clientOrderId;

  const result = await request<{ orderId: string }>("/v5/order/create", { method: "POST", body, signed: true });
  return getOrder(params.symbol, result.orderId);
}

type BybitOrderHistoryEntry = { orderId: string; orderStatus: string; side: string; cumExecQty: string; cumExecValue: string; cumExecFee: string; avgPrice: string };

function toOrderResult(symbol: string, order: BybitOrderHistoryEntry): OrderResult {
  // Bybit v5/order/history não devolve a moeda da taxa — por omissão a Bybit
  // cobra a taxa na moeda recebida (base numa compra, quote numa venda),
  // salvo se a conta usar um token de taxas dedicado. Assunção documentada
  // aqui; a confirmar contra a conta real antes de operar com capital maior.
  const feeAsset = order.side === "Buy" ? symbol.replace(/USDT$/, "") : "USDT";

  return {
    orderId: order.orderId,
    status: order.orderStatus === "Filled" ? "FILLED" : order.orderStatus === "Cancelled" ? "CANCELED" : order.orderStatus.toUpperCase(),
    executedQty: order.cumExecQty,
    cummulativeQuoteQty: order.cumExecValue,
    fills: Number(order.cumExecQty) > 0
      ? [{ price: order.avgPrice, qty: order.cumExecQty, commission: order.cumExecFee, commissionAsset: feeAsset }]
      : [],
  };
}

async function getOrder(symbol: string, orderId: string): Promise<OrderResult> {
  const result = await request<{ list: BybitOrderHistoryEntry[] }>("/v5/order/history", {
    params: { category: "spot", symbol, orderId },
    signed: true,
  });
  const order = result.list[0];
  if (!order) throw new ExchangeApiError(`Bybit: ordem ${orderId} não encontrada em ${symbol}`);
  return toOrderResult(symbol, order);
}

async function getOrderByClientId(symbol: string, clientOrderId: string): Promise<OrderResult | null> {
  const result = await request<{ list: BybitOrderHistoryEntry[] }>("/v5/order/history", {
    params: { category: "spot", symbol, orderLinkId: clientOrderId },
    signed: true,
  });
  const order = result.list[0];
  return order ? toOrderResult(symbol, order) : null;
}

export const bybitAdapter: ExchangeAdapter = {
  id: "bybit",
  hasCredentials,
  getOrderBookDepth,
  getExchangeInfo,
  getAccountBalances,
  getCommissionRates,
  placeMarketOrder,
  getOrder,
  getOrderByClientId,
};
