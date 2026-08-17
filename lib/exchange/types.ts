import type { ExchangeId } from "@/db/schema";

export type { ExchangeId };

/** Bids/asks ficam como strings (preço, quantidade) — nunca convertidos
 *  para Number antes de precisar, para não perder precisão dos decimais. */
export type OrderBookDepth = {
  bids: [string, string][];
  asks: [string, string][];
};

export type SymbolFilter =
  | { type: "LOT_SIZE"; minQty: string; maxQty: string; stepSize: string }
  | { type: "PRICE_FILTER"; minPrice: string; maxPrice: string; tickSize: string }
  | { type: "NOTIONAL" | "MIN_NOTIONAL"; minNotional: string };

export type ExchangeSymbol = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  filters: SymbolFilter[];
};

export type ExchangeInfo = {
  symbols: ExchangeSymbol[];
};

export type AccountBalance = {
  asset: string;
  free: string;
  locked: string;
};

export type CommissionRates = {
  takerFeePct: number;
};

export type PlaceMarketOrderParams = {
  symbol: string;
  side: "BUY" | "SELL";
  /** Só um dos dois: quoteOrderQty para gastar um montante exacto de USDT
   *  numa compra, quantity para vender uma quantidade exacta do activo. */
  quantity?: string;
  quoteOrderQty?: string;
  /** ID que nós geramos (não a exchange) — permite perguntar depois "isto
   *  chegou a acontecer?" sem depender de termos recebido resposta da
   *  primeira tentativa (idempotência, roteiro P0). */
  clientOrderId?: string;
};

export type OrderResult = {
  orderId: string;
  status: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  fills: { price: string; qty: string; commission: string; commissionAsset: string }[];
};

/** Interface comum às duas exchanges (secção 16) — cada adaptador implementa
 *  isto sobre as suas próprias chamadas REST; o resto do motor (scanner,
 *  avaliação, execução) nunca fala directamente com Binance/Bybit. */
export interface ExchangeAdapter {
  id: ExchangeId;
  hasCredentials(): boolean;
  getOrderBookDepth(symbol: string, limit?: number): Promise<OrderBookDepth>;
  getExchangeInfo(): Promise<ExchangeInfo>;
  getAccountBalances(): Promise<AccountBalance[]>;
  getCommissionRates(symbol: string): Promise<CommissionRates>;
  placeMarketOrder(params: PlaceMarketOrderParams): Promise<OrderResult>;
  getOrder(symbol: string, orderId: string): Promise<OrderResult>;
  /** Consulta uma ordem pelo ID que nós próprios geramos — devolve `null`
   *  se a exchange nunca a viu (nunca chegou a ser recebida), distinto de
   *  um erro de rede a consultar. Usado pelo Recovery Engine e pela
   *  reconciliação no arranque do worker para nunca reenviar uma ordem que
   *  na realidade já tinha tido sucesso. */
  getOrderByClientId(symbol: string, clientOrderId: string): Promise<OrderResult | null>;
}

export class ExchangeApiError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "ExchangeApiError";
    this.status = status;
    this.body = body;
  }
}
