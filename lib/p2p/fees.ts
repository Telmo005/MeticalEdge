/**
 * Custos conhecidos, com fonte — porte directo de p2p_mzn_analyzer/fees.py
 * (a ferramenta de análise original em Python), depois estendido com o
 * custo REAL do dinheiro móvel, que o modelo anterior calculava mas nunca
 * aplicava (as funções de M-Pesa/e-Mola existiam e nunca eram chamadas por
 * ninguém — o lucro mostrado ignorava-as por completo).
 *
 * Resumo das fontes:
 *
 * - Binance P2P taker fee: taxa fixa em USDT por ordem, paga por quem TOMA
 *   o anúncio (o utilizador desta app, na prática). Reajustada a partir de
 *   2025-09-22 para 0.06–0.08 USDT/ordem em mercados incluindo MZN. Valor
 *   exacto por tier não é público sem login — por isso um intervalo.
 * - Binance P2P maker fee: cobrada a quem PUBLICA o anúncio. Relevante
 *   desde que a app passou a avaliar a estratégia de anúncio próprio
 *   (ver lib/p2p/maker.ts) — ~0.15%–0.35% do valor negociado, não
 *   confirmado oficialmente para MZN, por isso também um intervalo.
 * - M-Pesa/e-Mola Moçambique: tarifários publicados. Os escalões de envio
 *   do M-Pesa são uma ESTIMATIVA calibrada (o tarifário muda com
 *   frequência) — por isso são substituíveis em /settings.
 */

export const TAKER_FEE_USDT_CONSERVADOR = 0.08;
export const TAKER_FEE_USDT_OTIMISTA = 0.05;
export const TAKER_FEE_USDT_MEDIO = (TAKER_FEE_USDT_CONSERVADOR + TAKER_FEE_USDT_OTIMISTA) / 2;

/** Fracção do valor negociado cobrada a quem publica o anúncio. */
export const MAKER_FEE_PCT_CONSERVADOR = 0.0035;
export const MAKER_FEE_PCT_OTIMISTA = 0.0015;
export const MAKER_FEE_PCT_MEDIO = (MAKER_FEE_PCT_CONSERVADOR + MAKER_FEE_PCT_OTIMISTA) / 2;

export type CostScenarioLabel = "conservador" | "medio" | "otimista";

export type CostScenario = {
  label: CostScenarioLabel;
  takerFeeUsdt: number;
  makerFeePct: number;
};

export const CONSERVADOR: CostScenario = {
  label: "conservador",
  takerFeeUsdt: TAKER_FEE_USDT_CONSERVADOR,
  makerFeePct: MAKER_FEE_PCT_CONSERVADOR,
};
export const MEDIO: CostScenario = {
  label: "medio",
  takerFeeUsdt: TAKER_FEE_USDT_MEDIO,
  makerFeePct: MAKER_FEE_PCT_MEDIO,
};
export const OTIMISTA: CostScenario = {
  label: "otimista",
  takerFeeUsdt: TAKER_FEE_USDT_OTIMISTA,
  makerFeePct: MAKER_FEE_PCT_OTIMISTA,
};

export const ALL_SCENARIOS: CostScenario[] = [CONSERVADOR, MEDIO, OTIMISTA];

// ---------------------------------------------------------------------------
// Dinheiro móvel — o custo que faltava
// ---------------------------------------------------------------------------

/** Como o dinheiro entra e sai em cada perna da operação. */
export type PaymentRail = "nenhum" | "mpesa" | "emola";

// M-Pesa (Vodafone) Moçambique — levantamento (cash-out), escalões em MZN
const MPESA_WITHDRAW_BRACKETS: [number, number][] = [
  [50, 2], [200, 4], [500, 8], [1000, 15], [2500, 25],
  [5000, 40], [10000, 60], [25000, 90], [50000, 125], [Infinity, 175],
];

/** Transferência M-Pesa para outro número (o que pagas ao comprar USDT).
 *  ESTIMATIVA — o tarifário oficial muda com frequência; é por isso que
 *  /settings deixa substituir este custo por um valor fixo teu. */
const MPESA_SEND_BRACKETS: [number, number][] = [
  [100, 1], [500, 5], [1000, 10], [2500, 18], [5000, 30],
  [10000, 48], [25000, 75], [50000, 110], [Infinity, 160],
];

// e-Mola Moçambique
const EMOLA_WITHDRAW_BRACKETS: [number, number][] = [
  [2500, 18], [10000, 45], [25000, 75], [50000, 110], [Infinity, 150],
];
const EMOLA_SEND_BRACKETS: [number, number][] = [
  [500, 0], [2500, 8], [10000, 20], [25000, 40], [Infinity, 60],
];

function bracketFee(brackets: [number, number][], amountMzn: number): number {
  if (!Number.isFinite(amountMzn) || amountMzn <= 0) return 0;
  for (const [limit, fee] of brackets) if (amountMzn <= limit) return fee;
  return brackets[brackets.length - 1][1];
}

export function mpesaWithdrawFee(amountMzn: number): number {
  return bracketFee(MPESA_WITHDRAW_BRACKETS, amountMzn);
}
export function mpesaSendFee(amountMzn: number): number {
  return bracketFee(MPESA_SEND_BRACKETS, amountMzn);
}
export function emolaWithdrawFee(amountMzn: number): number {
  return bracketFee(EMOLA_WITHDRAW_BRACKETS, amountMzn);
}
export function emolaSendFee(amountMzn: number): number {
  return bracketFee(EMOLA_SEND_BRACKETS, amountMzn);
}

/** Custo de ENVIAR `amountMzn` pela via escolhida (perna de compra: pagas
 *  ao comerciante que te vende o USDT). */
export function railSendFee(rail: PaymentRail, amountMzn: number): number {
  if (rail === "mpesa") return mpesaSendFee(amountMzn);
  if (rail === "emola") return emolaSendFee(amountMzn);
  return 0;
}

/** Custo de LEVANTAR `amountMzn` (só se quiseres o dinheiro em mão no fim;
 *  se o deixares na carteira para a próxima operação, não pagas isto). */
export function railWithdrawFee(rail: PaymentRail, amountMzn: number): number {
  if (rail === "mpesa") return mpesaWithdrawFee(amountMzn);
  if (rail === "emola") return emolaWithdrawFee(amountMzn);
  return 0;
}

// ---------------------------------------------------------------------------
// Modelo de custo unificado
// ---------------------------------------------------------------------------

/** Preferências de custo do utilizador — vêm de /settings, mas têm sempre
 *  um valor por omissão seguro para nunca haver um cálculo sem custos. */
export type CostPreferences = {
  /** Via usada para pagar/receber MZN nas ordens P2P. */
  rail: PaymentRail;
  /** Contar o levantamento do dinheiro no fim da operação. Falso por
   *  omissão: quem opera em ciclo deixa o saldo na carteira. */
  includeCashOut: boolean;
  /** Número de transferências por perna. Uma ordem P2P = uma transferência
   *  para o comerciante, mas alguns pedem o valor repartido. */
  transfersPerOrder: number;
};

export const DEFAULT_COST_PREFERENCES: CostPreferences = {
  rail: "mpesa",
  includeCashOut: false,
  transfersPerOrder: 1,
};

export type CostBreakdown = {
  /** Taxa da Binance por ordem tomada (taker), convertida em MZN. */
  takerFeeMzn: number;
  /** Taxa da Binance sobre o anúncio próprio (maker), em MZN. */
  makerFeeMzn: number;
  /** Custo de mover MZN por M-Pesa/e-Mola nas pernas de compra. */
  railSendFeeMzn: number;
  /** Custo de levantar o dinheiro no fim (só se `includeCashOut`). */
  railWithdrawFeeMzn: number;
  /** Soma de tudo. */
  totalMzn: number;
};

export type CostInputs = {
  /** Ordens TOMADAS (as que pagam taker fee) em toda a viagem. */
  takerOrders: number;
  /** Preço médio MZN/USDT da viagem — converte a taxa em USDT para MZN. */
  avgPriceMzn: number;
  /** MZN efectivamente gasto na perna de compra. */
  buyVolumeMzn: number;
  /** MZN recebido na perna de venda. */
  sellVolumeMzn: number;
  /** MZN negociado através de anúncio PRÓPRIO (maker). 0 na estratégia
   *  normal de tomar anúncios. */
  makerVolumeMzn?: number;
  /** Número de transferências de dinheiro na perna de compra — por omissão
   *  uma por ordem de compra. */
  buyTransfers?: number;
};

/**
 * O custo real de uma viagem completa, num só sítio. Antes disto o cálculo
 * de lucro só descontava a taxa da Binance e ignorava por completo o que
 * custa mover Meticais — numa operação de 5.000 MZN isso é a diferença
 * entre "lucro de 40 MZN" e "lucro de 10 MZN".
 */
export function computeCosts(
  scenario: CostScenario,
  inputs: CostInputs,
  prefs: CostPreferences = DEFAULT_COST_PREFERENCES
): CostBreakdown {
  const avgPrice = inputs.avgPriceMzn > 0 ? inputs.avgPriceMzn : 0;

  const takerFeeMzn = Math.max(0, inputs.takerOrders) * scenario.takerFeeUsdt * avgPrice;
  const makerFeeMzn = Math.max(0, inputs.makerVolumeMzn ?? 0) * scenario.makerFeePct;

  const transfers = Math.max(1, Math.round(prefs.transfersPerOrder));
  const nBuyTransfers = Math.max(0, inputs.buyTransfers ?? 0) * transfers;
  // A taxa de envio é por escalão, por isso repartir o mesmo total por
  // várias transferências custa mais — daí dividir o volume pelo número de
  // envios em vez de aplicar o escalão do total de uma vez.
  const perTransferMzn = nBuyTransfers > 0 ? inputs.buyVolumeMzn / nBuyTransfers : 0;
  const railSendFeeMzn = nBuyTransfers * railSendFee(prefs.rail, perTransferMzn);

  const railWithdrawFeeMzn = prefs.includeCashOut
    ? railWithdrawFee(prefs.rail, inputs.sellVolumeMzn)
    : 0;

  return {
    takerFeeMzn,
    makerFeeMzn,
    railSendFeeMzn,
    railWithdrawFeeMzn,
    totalMzn: takerFeeMzn + makerFeeMzn + railSendFeeMzn + railWithdrawFeeMzn,
  };
}

/** Etiqueta legível da via de pagamento, para a interface. */
export const RAIL_LABEL: Record<PaymentRail, string> = {
  nenhum: "Sem custo de transferência",
  mpesa: "M-Pesa",
  emola: "e-Mola",
};
