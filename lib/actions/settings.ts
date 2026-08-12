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
