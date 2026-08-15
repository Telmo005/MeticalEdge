"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings, capitalLedger } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { RECOMMENDED_RULE_DEFAULTS } from "@/lib/rule-defaults";

/** Ajuste manual do capital (definir o valor inicial, ou corrigir depois de
 *  um levantamento/depósito fora do ciclo normal de trades). */
export async function setCapitalAction(newCapitalMzn: number, reason = "manual_adjustment") {
  await requireUser();

  return db.transaction(async (tx) => {
    const [config] = await tx.select().from(settings).where(eq(settings.id, true)).limit(1);
    const isFirstTime = Number(config.initialCapitalMzn) === 0;

    const [updated] = await tx
      .update(settings)
      .set({
        currentCapitalMzn: newCapitalMzn.toFixed(2),
        initialCapitalMzn: isFirstTime ? newCapitalMzn.toFixed(2) : config.initialCapitalMzn,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, true))
      .returning();

    await tx.insert(capitalLedger).values({
      deltaMzn: (newCapitalMzn - Number(config.currentCapitalMzn)).toFixed(2),
      reason,
      resultingBalanceMzn: newCapitalMzn.toFixed(2),
    });

    revalidatePath("/");
    revalidatePath("/settings");
    return updated;
  });
}

/** Único parâmetro simples que decide o que aparece por omissão nas listas
 *  de oportunidades (ex.: "Por comerciante") — em MZN, não percentagem,
 *  para não obrigar ninguém a calcular nada. */
export async function setMinDisplayProfitFormAction(formData: FormData) {
  await requireUser();
  const value = Number(formData.get("minDisplayProfitMzn"));
  if (!Number.isFinite(value)) return;

  await db
    .update(settings)
    .set({ minDisplayProfitMzn: value.toFixed(2), updatedAt: new Date() })
    .where(eq(settings.id, true));

  revalidatePath("/", "layout");
}

/**
 * Custo real de mover Meticais. Isto não é cosmético: sem estes valores o
 * lucro apresentado era sistematicamente optimista, porque só descontava a
 * taxa da Binance e fingia que as transferências de M-Pesa/e-Mola eram
 * grátis. Numa operação de 5.000 MZN a diferença é da ordem de 30 MZN — mais
 * do que a margem inteira de muitas oportunidades.
 */
export async function updateCostSettingsFormAction(formData: FormData) {
  await requireUser();

  const rawRail = String(formData.get("costRail") ?? "mpesa");
  const costRail = (["nenhum", "mpesa", "emola"] as const).includes(rawRail as "nenhum" | "mpesa" | "emola")
    ? (rawRail as "nenhum" | "mpesa" | "emola")
    : "mpesa";

  const transfersRaw = Number(formData.get("transfersPerOrder"));
  const transfersPerOrder = Number.isFinite(transfersRaw)
    ? Math.min(10, Math.max(1, Math.round(transfersRaw)))
    : 1;

  await db
    .update(settings)
    .set({
      costRail,
      includeCashOut: formData.get("includeCashOut") === "on",
      transfersPerOrder,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, true));

  revalidatePath("/", "layout");
}

/**
 * Quando é que o sistema deve avisar. Em Meticais de lucro LÍQUIDO, porque
 * é essa a pergunta real ("vale a pena largar o que estou a fazer por
 * isto?") — e porque o gatilho anterior olhava para o lucro bruto, o que
 * fazia chegar avisos de oportunidades que davam prejuízo depois das taxas.
 */
export async function setMinNetProfitAlertFormAction(formData: FormData) {
  await requireUser();
  const value = Number(formData.get("minNetProfitAlertMzn"));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("O lucro mínimo para avisar tem de ser zero ou mais.");
  }

  await db
    .update(settings)
    .set({ minNetProfitAlertMzn: value.toFixed(2), updatedAt: new Date() })
    .where(eq(settings.id, true));

  revalidatePath("/", "layout");
}

export type RuleSettingsInput = {
  minNetPctAlert: number;
  minGrossSpreadPct: number;
  minCounterpartyFinishRate: number;
  minCounterpartyMonthlyOrders: number;
  maxOrdersPerLeg: number;
  alertCooldownMinutes: number;
  scanningEnabled: boolean;
};

export async function setCapitalFormAction(formData: FormData) {
  const value = Number(formData.get("currentCapitalMzn"));
  if (!Number.isFinite(value) || value < 0) return;
  await setCapitalAction(value);
}

/** Capital da arbitragem internacional (lib/p2p/intl/) — independente do
 *  capital MZN acima, sem ledger próprio (ainda não há trades reportados
 *  nessa frente, só simulação de spreads). */
export async function setIntlCapitalFormAction(formData: FormData) {
  await requireUser();
  const value = Number(formData.get("intlCapitalUsd"));
  if (!Number.isFinite(value) || value < 0) return;

  await db
    .update(settings)
    .set({ intlCapitalUsd: value.toFixed(2), updatedAt: new Date() })
    .where(eq(settings.id, true));

  revalidatePath("/", "layout");
}

export async function updateRuleSettingsFormAction(formData: FormData) {
  await updateRuleSettingsAction({
    minNetPctAlert: Number(formData.get("minNetPctAlert")),
    minGrossSpreadPct: Number(formData.get("minGrossSpreadPct")),
    minCounterpartyFinishRate: Number(formData.get("minCounterpartyFinishRate")),
    minCounterpartyMonthlyOrders: Number(formData.get("minCounterpartyMonthlyOrders")),
    maxOrdersPerLeg: Number(formData.get("maxOrdersPerLeg")),
    alertCooldownMinutes: Number(formData.get("alertCooldownMinutes")),
    scanningEnabled: formData.get("scanningEnabled") === "on",
  });
}

export async function updateRuleSettingsAction(input: RuleSettingsInput) {
  await requireUser();

  await db
    .update(settings)
    .set({
      minNetPctAlert: input.minNetPctAlert.toFixed(3),
      minGrossSpreadPct: input.minGrossSpreadPct.toFixed(3),
      minCounterpartyFinishRate: input.minCounterpartyFinishRate.toFixed(4),
      minCounterpartyMonthlyOrders: input.minCounterpartyMonthlyOrders,
      maxOrdersPerLeg: input.maxOrdersPerLeg,
      alertCooldownMinutes: input.alertCooldownMinutes,
      scanningEnabled: input.scanningEnabled,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, true));

  revalidatePath("/settings");
}

export async function updateAlertChannelsFormAction(formData: FormData) {
  await requireUser();

  const smsAlertsEnabled = formData.get("smsAlertsEnabled") === "on";
  const alertPhoneE164 = String(formData.get("alertPhoneE164") ?? "").trim();

  if (smsAlertsEnabled && !/^\+[1-9]\d{6,14}$/.test(alertPhoneE164)) {
    throw new Error("Número inválido — usa o formato internacional, ex.: +258840000000");
  }

  await db
    .update(settings)
    .set({
      smsAlertsEnabled,
      alertPhoneE164: alertPhoneE164 || null,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, true));

  revalidatePath("/settings");
}

/** Botão "repor valores recomendados" — não mexe em scanning_enabled (é um
 *  interruptor operacional, não uma "regra", repor não deve religá-lo às
 *  cegas se alguém o desligou de propósito). */
export async function resetRuleSettingsFormAction() {
  await requireUser();

  await db
    .update(settings)
    .set({
      minNetPctAlert: RECOMMENDED_RULE_DEFAULTS.minNetPctAlert.toFixed(3),
      minGrossSpreadPct: RECOMMENDED_RULE_DEFAULTS.minGrossSpreadPct.toFixed(3),
      minCounterpartyFinishRate: RECOMMENDED_RULE_DEFAULTS.minCounterpartyFinishRate.toFixed(4),
      minCounterpartyMonthlyOrders: RECOMMENDED_RULE_DEFAULTS.minCounterpartyMonthlyOrders,
      maxOrdersPerLeg: RECOMMENDED_RULE_DEFAULTS.maxOrdersPerLeg,
      alertCooldownMinutes: RECOMMENDED_RULE_DEFAULTS.alertCooldownMinutes,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, true));

  revalidatePath("/settings");
}
