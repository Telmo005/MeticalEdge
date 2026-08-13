import { DEFAULT_COST_PREFERENCES, type CostPreferences, type PaymentRail } from "@/lib/p2p/fees";
import type { Settings } from "@/db/schema";

const VALID_RAILS: PaymentRail[] = ["nenhum", "mpesa", "emola"];

/**
 * Traduz as definições guardadas para o que o motor de custo espera. Vive
 * fora de lib/p2p/ de propósito: o motor não deve saber que existe uma
 * tabela `settings`, para continuar a poder ser testado com valores à mão.
 *
 * Tolerante a `undefined` porque há um caminho real em que as definições
 * ainda não foram lidas (primeira execução, antes do onboarding) — nesse
 * caso vale mais assumir o custo por omissão do que assumir custo zero e
 * mostrar um lucro que não existe.
 */
export function costPreferencesFrom(config: Settings | null | undefined): CostPreferences {
  if (!config) return DEFAULT_COST_PREFERENCES;
  const rail = VALID_RAILS.includes(config.costRail as PaymentRail)
    ? (config.costRail as PaymentRail)
    : DEFAULT_COST_PREFERENCES.rail;
  return {
    rail,
    includeCashOut: Boolean(config.includeCashOut),
    transfersPerOrder: Math.min(10, Math.max(1, config.transfersPerOrder ?? 1)),
  };
}
