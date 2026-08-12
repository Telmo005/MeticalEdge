/** Mesmos valores por omissão da migração (supabase/migrations/0000_...sql)
 *  — reproduzem a Secção 10 do relatório original. Usado pelo botão "repor
 *  valores recomendados" e para mostrar o valor de referência ao lado de
 *  cada campo no formulário de /settings.
 *
 *  Vive fora de lib/actions/settings.ts porque um ficheiro "use server" só
 *  pode exportar funções async — uma constante exportada dali parte o
 *  build. */
export const RECOMMENDED_RULE_DEFAULTS = {
  minNetPctAlert: 0.15,
  minGrossSpreadPct: 0.6,
  minCounterpartyFinishRate: 0.95,
  minCounterpartyMonthlyOrders: 50,
  maxOrdersPerLeg: 3,
  alertCooldownMinutes: 20,
} as const;
