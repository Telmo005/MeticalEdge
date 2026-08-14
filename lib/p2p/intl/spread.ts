/**
 * Cálculo de spread entre duas plataformas P2P para o mesmo par/fiat —
 * versão Fase 1 (validação): custos como percentagem estimada, não o
 * modelo real por escalão que lib/p2p/fees.ts usa para MZN (esse depende de
 * tarifários bancários locais que só se conhecem por par, na Fase 2).
 */

export type CostModelPct = {
  /** Taxa/slippage estimada ao comprar na plataforma de origem. */
  buyPct: number;
  /** Taxa/slippage estimada ao vender na plataforma de destino. */
  sellPct: number;
};

export type SpreadOpportunity = {
  bestAsk: number;
  bestBid: number;
  spreadGrossPct: number;
  spreadNetPct: number;
  isViable: boolean;
};

/** `bestAsk` = preço a que se compra o asset (plataforma de origem).
 *  `bestBid` = preço a que se vende o asset (plataforma de destino).
 *  Ambos no mesmo fiat. */
export function calculateOpportunity(
  bestAsk: number,
  bestBid: number,
  costs: CostModelPct,
  minNetPctViable: number
): SpreadOpportunity {
  if (!(bestAsk > 0) || !(bestBid > 0)) {
    return { bestAsk, bestBid, spreadGrossPct: 0, spreadNetPct: 0, isViable: false };
  }
  const spreadGrossPct = ((bestBid - bestAsk) / bestAsk) * 100;
  const spreadNetPct = spreadGrossPct - (costs.buyPct + costs.sellPct) * 100;
  return {
    bestAsk,
    bestBid,
    spreadGrossPct,
    spreadNetPct,
    isViable: spreadNetPct >= minNetPctViable,
  };
}
