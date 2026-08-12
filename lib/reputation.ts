export type ReputationTone = "good" | "warning" | "critical";

/** Mesmo critério em toda a app — usado por tabelas, planos de execução e
 *  notificações, para nunca classificar o mesmo comerciante de forma
 *  diferente consoante o ecrã. */
export function reputationTone(finishRate: number | null, orders: number | null): ReputationTone {
  if (finishRate === null || orders === null) return "warning";
  if (finishRate >= 0.97 && orders >= 200) return "good";
  if (finishRate >= 0.95 && orders >= 50) return "warning";
  return "critical";
}

const REPUTATION_LABEL: Record<ReputationTone, string> = {
  good: "fiável",
  warning: "moderado",
  critical: "arriscado",
};

/** Palavra simples ao lado do número — "99% conclusão" sozinho não diz a
 *  quem não é técnico se isso é bom ou mau. */
export function reputationLabel(finishRate: number | null, orders: number | null): string {
  return REPUTATION_LABEL[reputationTone(finishRate, orders)];
}
