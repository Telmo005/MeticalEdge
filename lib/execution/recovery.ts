import type { ExchangeAdapter, OrderResult } from "@/lib/exchange/types";

/** Recovery Engine (secções 9-11): quando uma perna não preenche por
 *  completo dentro do tempo disponível, tenta-se **uma única vez** reenviar
 *  a quantidade em falta ao preço de mercado actual. Sem sequências
 *  infinitas, sem martingale (secção 38) — se esta retentativa também
 *  falhar ou o prazo expirar, o chamador aceita o desequilíbrio e regista
 *  tudo com clareza para o Rebalancing Monitor.
 *
 *  Antes de reenviar, confirma por idempotência (roteiro P0) que a
 *  tentativa original não teve sucesso apesar de termos recebido erro ou
 *  timeout do nosso lado — sem isto, um timeout de rede numa ordem que na
 *  realidade foi aceite pela exchange levaria a duplicá-la. */
export async function recoverLeg(params: {
  exchange: ExchangeAdapter;
  pair: string;
  side: "BUY" | "SELL";
  originalClientOrderId: string;
  retryClientOrderId: string;
  /** Para SELL: quantidade do activo ainda por vender. */
  remainingQuantity?: number;
  /** Para BUY: USDT ainda por gastar. */
  remainingQuoteUsdt?: number;
  deadline: number;
}): Promise<{ orderResult: OrderResult | null; error?: string; recoveredViaLookup?: boolean }> {
  try {
    const existing = await params.exchange.getOrderByClientId(params.pair, params.originalClientOrderId);
    if (existing && Number(existing.executedQty) > 0) {
      return { orderResult: existing, recoveredViaLookup: true };
    }
  } catch {
    // não foi possível confirmar por consulta — segue para a retentativa
    // normal, mais seguro do que desistir sem tentar nada.
  }

  if (Date.now() > params.deadline) {
    return { orderResult: null, error: "prazo máximo de execução excedido antes da retentativa" };
  }

  try {
    const orderResult = await params.exchange.placeMarketOrder(
      params.side === "BUY"
        ? { symbol: params.pair, side: "BUY", quoteOrderQty: (params.remainingQuoteUsdt ?? 0).toFixed(8), clientOrderId: params.retryClientOrderId }
        : { symbol: params.pair, side: "SELL", quantity: (params.remainingQuantity ?? 0).toFixed(8), clientOrderId: params.retryClientOrderId },
    );
    return { orderResult };
  } catch (err) {
    return { orderResult: null, error: err instanceof Error ? err.message : String(err) };
  }
}
