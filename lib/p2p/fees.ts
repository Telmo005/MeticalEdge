/**
 * Custos conhecidos, com fonte — porte directo de p2p_mzn_analyzer/fees.py
 * (a ferramenta de análise original em Python). Ver esse ficheiro para as
 * fontes completas; resumo:
 *
 * - Binance P2P taker fee: taxa fixa em USDT por ordem, paga por quem TOMA
 *   o anúncio (o utilizador desta app, na prática). Reajustada a partir de
 *   2025-09-22 para 0.06–0.08 USDT/ordem em mercados incluindo MZN. Valor
 *   exacto por tier não é público sem login — por isso um intervalo.
 * - Binance P2P maker fee: só relevante se a app um dia postar anúncios
 *   próprios (não é o caso do MVP) — ~0.15%–0.35%, não confirmado para MZN.
 * - M-Pesa/e-Mola Moçambique: tarifários oficiais (ver fees.py).
 */

export const TAKER_FEE_USDT_CONSERVADOR = 0.08;
export const TAKER_FEE_USDT_OTIMISTA = 0.05;
export const TAKER_FEE_USDT_MEDIO = (TAKER_FEE_USDT_CONSERVADOR + TAKER_FEE_USDT_OTIMISTA) / 2;

export type CostScenario = { label: "conservador" | "medio" | "otimista"; takerFeeUsdt: number };

export const CONSERVADOR: CostScenario = { label: "conservador", takerFeeUsdt: TAKER_FEE_USDT_CONSERVADOR };
export const MEDIO: CostScenario = { label: "medio", takerFeeUsdt: TAKER_FEE_USDT_MEDIO };
export const OTIMISTA: CostScenario = { label: "otimista", takerFeeUsdt: TAKER_FEE_USDT_OTIMISTA };

export const ALL_SCENARIOS: CostScenario[] = [CONSERVADOR, MEDIO, OTIMISTA];

// M-Pesa (Vodafone) Moçambique — levantamento (cash-out), escalões em MZN
const MPESA_WITHDRAW_BRACKETS: [number, number][] = [
  [50, 2], [200, 4], [500, 8], [1000, 15], [2500, 25],
  [5000, 40], [10000, 60], [25000, 90], [50000, 125], [Infinity, 175],
];
export function mpesaWithdrawFee(amountMzn: number): number {
  for (const [limit, fee] of MPESA_WITHDRAW_BRACKETS) if (amountMzn <= limit) return fee;
  return MPESA_WITHDRAW_BRACKETS[MPESA_WITHDRAW_BRACKETS.length - 1][1];
}

// e-Mola Moçambique
const EMOLA_WITHDRAW_BRACKETS: [number, number][] = [[2500, 18], [10000, 45], [25000, 75], [50000, 110]];
const EMOLA_SEND_BRACKETS: [number, number][] = [[500, 0], [2500, 8], [10000, 20], [25000, 40]];
export function emolaWithdrawFee(amountMzn: number): number {
  for (const [limit, fee] of EMOLA_WITHDRAW_BRACKETS) if (amountMzn <= limit) return fee;
  return EMOLA_WITHDRAW_BRACKETS[EMOLA_WITHDRAW_BRACKETS.length - 1][1];
}
export function emolaSendFee(amountMzn: number): number {
  for (const [limit, fee] of EMOLA_SEND_BRACKETS) if (amountMzn <= limit) return fee;
  return EMOLA_SEND_BRACKETS[EMOLA_SEND_BRACKETS.length - 1][1];
}
