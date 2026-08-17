"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { botSettings } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function updateAlertChannelsFormAction(formData: FormData) {
  await requireUser();

  const smsAlertsEnabled = formData.get("smsAlertsEnabled") === "on";
  const alertPhoneE164 = String(formData.get("alertPhoneE164") ?? "").trim();

  if (smsAlertsEnabled && !/^\+[1-9]\d{6,14}$/.test(alertPhoneE164)) {
    throw new Error("Número inválido — usa o formato internacional, ex.: +258840000000");
  }

  await db
    .update(botSettings)
    .set({
      smsAlertsEnabled,
      alertPhoneE164: alertPhoneE164 || null,
      updatedAt: new Date(),
    })
    .where(eq(botSettings.id, true));

  revalidatePath("/settings");
}
