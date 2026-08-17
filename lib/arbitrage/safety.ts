/** Tamanho da operação: nunca o saldo inteiro de uma vez (secção 13) — o
 *  menor entre a percentagem do saldo livre da exchange compradora e o
 *  tecto absoluto configurado. */
export function computeTradeSizeUsdt(buyExchangeUsdtFree: number, tradeSizePct: number, maxTradeUsdt: number): number {
  const byPct = buyExchangeUsdtFree * (tradeSizePct / 100);
  return Math.max(0, Math.min(byPct, maxTradeUsdt, buyExchangeUsdtFree));
}

export function isWithinDailyLossLimit(todayNetUsdt: number, dailyLossLimitUsdt: number): boolean {
  return todayNetUsdt > -dailyLossLimitUsdt;
}

export function hasTooManyConsecutiveErrors(consecutiveErrors: number, maxConsecutiveErrors: number): boolean {
  return consecutiveErrors >= maxConsecutiveErrors;
}

/** Secção 14 — Rebalancing Monitor: só informa, nunca transfere sozinho
 *  (secção 15). Desequilíbrio > 30% do total combinado entre as duas
 *  exchanges dispara a recomendação no painel. */
export function checkRebalanceRecommended(
  totalValueByExchange: Record<string, number>,
): { recommended: boolean; reason: string | null } {
  const values = Object.values(totalValueByExchange);
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0 || values.length < 2) return { recommended: false, reason: null };

  const evenShare = total / values.length;
  const entries = Object.entries(totalValueByExchange);
  const [mostSkewedId, mostSkewedValue] = entries.reduce((worst, entry) =>
    Math.abs(entry[1] - evenShare) > Math.abs(worst[1] - evenShare) ? entry : worst,
  entries[0]);

  const skewPct = evenShare > 0 ? (Math.abs(mostSkewedValue - evenShare) / evenShare) * 100 : 0;
  if (skewPct > 30) {
    const direction = mostSkewedValue > evenShare ? "mais capital" : "menos capital";
    return {
      recommended: true,
      reason: `${mostSkewedId} tem ${direction} do que o esperado (desvio de ${skewPct.toFixed(0)}% face à divisão equilibrada) — considera transferir manualmente para reequilibrar.`,
    };
  }
  return { recommended: false, reason: null };
}
