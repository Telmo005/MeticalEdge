import type { ExchangeId, OrderBookDepth } from "@/lib/exchange/types";
import { EXCHANGES, EXCHANGE_IDS, otherExchange } from "@/lib/exchange/registry";
import { evaluateOpportunity, type OpportunityEvaluation } from "@/lib/arbitrage/opportunity-engine";
import { computeTradeSizeUsdt } from "@/lib/arbitrage/safety";

export type ExchangeInventory = {
  usdtFree: number;
  /** Saldo de activos, por símbolo base (ex. "BTC"), na exchange. */
  assets: Record<string, number>;
};

export type ScanResult = {
  evaluations: OpportunityEvaluation[];
  best: OpportunityEvaluation | null;
};

function baseAssetOf(pair: string): string {
  return pair.endsWith("USDT") ? pair.slice(0, -4) : pair;
}

/** Para cada par vigiado, busca os dois livros de ordens em paralelo e
 *  avalia as duas direcções possíveis (secção 18: A compra/B vende e
 *  B compra/A vende) — nunca assume que uma exchange é sempre a mais
 *  barata. */
export async function scanForOpportunities(params: {
  pairs: string[];
  inventory: Record<ExchangeId, ExchangeInventory>;
  feePctByExchange: Record<ExchangeId, number>;
  tradeSizePct: number;
  maxTradeUsdt: number;
  minProfitPct: number;
  minSafetyMarginPct: number;
}): Promise<ScanResult> {
  const { pairs, inventory, feePctByExchange, tradeSizePct, maxTradeUsdt, minProfitPct, minSafetyMarginPct } = params;

  const books = new Map<string, OrderBookDepth | null>();
  await Promise.all(
    pairs.flatMap((pair) =>
      EXCHANGE_IDS.map(async (exchangeId) => {
        const key = `${exchangeId}:${pair}`;
        try {
          books.set(key, await EXCHANGES[exchangeId].getOrderBookDepth(pair, 100));
        } catch {
          books.set(key, null);
        }
      }),
    ),
  );

  const evaluations: OpportunityEvaluation[] = [];

  for (const pair of pairs) {
    const baseAsset = baseAssetOf(pair);
    for (const buyExchange of EXCHANGE_IDS) {
      const sellExchange = otherExchange(buyExchange);
      const buyBook = books.get(`${buyExchange}:${pair}`);
      const sellBook = books.get(`${sellExchange}:${pair}`);
      if (!buyBook || !sellBook) continue;

      const capitalUsdt = computeTradeSizeUsdt(inventory[buyExchange].usdtFree, tradeSizePct, maxTradeUsdt);
      if (capitalUsdt <= 0) continue;

      evaluations.push(
        evaluateOpportunity({
          pair,
          buyExchange,
          sellExchange,
          capitalUsdt,
          buyBook,
          sellBook,
          buyFeePct: feePctByExchange[buyExchange],
          sellFeePct: feePctByExchange[sellExchange],
          sellExchangeAssetAvailable: inventory[sellExchange].assets[baseAsset] ?? 0,
          minProfitPct,
          minSafetyMarginPct,
        }),
      );
    }
  }

  evaluations.sort((a, b) => b.netPct - a.netPct);
  const best = evaluations.find((e) => e.passedFilters) ?? null;

  return { evaluations, best };
}
