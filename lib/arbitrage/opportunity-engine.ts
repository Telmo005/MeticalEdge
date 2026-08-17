import type { ExchangeId, OrderBookDepth } from "@/lib/exchange/types";
import { walkBuy, walkSell } from "@/lib/arbitrage/orderbook-eval";

export type OpportunityEvaluation = {
  pair: string;
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  capitalUsdt: number;
  buyPrice: number;
  sellPrice: number;
  /** Quantidade do activo avaliada — usada tanto como alvo da compra
   *  (capitalUsdt / buyPrice) como da venda, já que as duas exchanges
   *  operam sobre inventário próprio e independente (secção 3), não uma
   *  transferência da mesma unidade comprada. */
  quantity: number;
  grossSpreadPct: number;
  feesPct: number;
  estimatedSlippagePct: number;
  netResultUsdt: number;
  netPct: number;
  liquidityOk: boolean;
  passedFilters: boolean;
  rejectReasons: string[];
};

export function evaluateOpportunity(params: {
  pair: string;
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  capitalUsdt: number;
  buyBook: OrderBookDepth;
  sellBook: OrderBookDepth;
  buyFeePct: number;
  sellFeePct: number;
  sellExchangeAssetAvailable: number;
  minProfitPct: number;
  minSafetyMarginPct: number;
}): OpportunityEvaluation {
  const {
    pair, buyExchange, sellExchange, capitalUsdt, buyBook, sellBook,
    buyFeePct, sellFeePct, sellExchangeAssetAvailable, minProfitPct, minSafetyMarginPct,
  } = params;

  const buy = walkBuy(buyBook, capitalUsdt, buyFeePct, true);
  const sell = walkSell(sellBook, buy.assetQty, sellFeePct, true);

  const idealBuy = walkBuy(buyBook, capitalUsdt, buyFeePct, false);
  const idealSell = walkSell(sellBook, idealBuy.assetQty, sellFeePct, false);
  const idealNetUsdt = idealSell.usdtOut - capitalUsdt;

  const netResultUsdt = sell.usdtOut - capitalUsdt;
  const netPct = capitalUsdt > 0 ? (netResultUsdt / capitalUsdt) * 100 : 0;
  const slippageCostUsdt = idealNetUsdt - netResultUsdt;
  const estimatedSlippagePct = capitalUsdt > 0 ? (slippageCostUsdt / capitalUsdt) * 100 : 0;

  const bestAsk = Number(buyBook.asks[0]?.[0] ?? 0);
  const bestBid = Number(sellBook.bids[0]?.[0] ?? 0);
  const grossSpreadPct = bestAsk > 0 ? ((bestBid - bestAsk) / bestAsk) * 100 : 0;

  const liquidityOk = buy.liquidityOk && sell.liquidityOk;
  const minRequiredPct = minProfitPct + minSafetyMarginPct;

  const rejectReasons: string[] = [];
  if (!liquidityOk) rejectReasons.push("liquidez insuficiente no livro de ordens");
  if (sellExchangeAssetAvailable < buy.assetQty) {
    rejectReasons.push(`inventário insuficiente em ${sellExchange} para vender`);
  }
  if (netPct < minRequiredPct) {
    rejectReasons.push(`margem líquida ${netPct.toFixed(3)}% abaixo do mínimo ${minRequiredPct.toFixed(3)}%`);
  }

  const computed = {
    buyPrice: buy.avgPrice,
    sellPrice: sell.avgPrice,
    quantity: buy.assetQty,
    grossSpreadPct,
    estimatedSlippagePct,
    netResultUsdt,
    netPct,
  };

  // Última linha de defesa: nenhum valor não-finito pode chegar à base de
  // dados nem influenciar a decisão de executar — se algo escapou à
  // limpeza dos livros de ordens, a oportunidade é sempre rejeitada.
  const hasInvalidNumber = Object.values(computed).some((v) => !Number.isFinite(v));
  if (hasInvalidNumber) rejectReasons.push("dados de mercado inconsistentes durante a avaliação");

  return {
    pair,
    buyExchange,
    sellExchange,
    capitalUsdt,
    buyPrice: hasInvalidNumber ? 0 : computed.buyPrice,
    sellPrice: hasInvalidNumber ? 0 : computed.sellPrice,
    quantity: hasInvalidNumber ? 0 : computed.quantity,
    grossSpreadPct: hasInvalidNumber ? 0 : computed.grossSpreadPct,
    feesPct: buyFeePct + sellFeePct,
    estimatedSlippagePct: hasInvalidNumber ? 0 : computed.estimatedSlippagePct,
    netResultUsdt: hasInvalidNumber ? 0 : computed.netResultUsdt,
    netPct: hasInvalidNumber ? 0 : computed.netPct,
    liquidityOk: hasInvalidNumber ? false : liquidityOk,
    passedFilters: rejectReasons.length === 0,
    rejectReasons,
  };
}
