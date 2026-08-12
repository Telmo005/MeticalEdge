"use server";

import { revalidatePath } from "next/cache";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { alerts, settings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { sendPush, sendSms } from "@/lib/messaging-client";

export type TestNotificationResult = {
  pushOk: boolean;
  pushError: string | null;
  smsAttempted: boolean;
  smsOk: boolean;
  smsError: string | null;
};

/** Botão "Testar notificações" em /settings — dispara um push (e SMS, se
 *  activo) reais, sem esperar por uma oportunidade de facto, só para
 *  confirmar que o gateway de mensagens está mesmo a entregar. Fica
 *  registado em alerts como qualquer outro alerta, para não teres dois
 *  caminhos diferentes a manter. */
export async function sendTestNotificationAction(): Promise<TestNotificationResult> {
  await requireUser();

  const [config] = await db.select().from(settings).where(eq(settings.id, true)).limit(1);

  const title = "Teste de notificação";
  const body = "Se recebeste isto, os alertas do MeticalEdge estão a funcionar.";

  const pushResult = await sendPush(title, body);

  let smsAttempted = false;
  let smsOk = false;
  let smsError: string | null = null;
  if (config?.smsAlertsEnabled && config.alertPhoneE164) {
    smsAttempted = true;
    const smsResult = await sendSms(config.alertPhoneE164, `${title}\n\n${body}`);
    smsOk = smsResult.ok;
    smsError = smsResult.ok ? null : smsResult.error;
  }

  await db.insert(alerts).values({
    opportunityId: null,
    title,
    body: `${body} (teste manual)`,
    gatewayMessageId: pushResult.ok ? pushResult.id : null,
    deliveryError: pushResult.ok ? smsError : `push: ${pushResult.error}${smsError ? `; sms: ${smsError}` : ""}`,
  });

  revalidatePath("/", "layout");

  return {
    pushOk: pushResult.ok,
    pushError: pushResult.ok ? null : pushResult.error,
    smsAttempted,
    smsOk,
    smsError,
  };
}

export async function markAllAlertsReadAction() {
  await requireUser();
  await db.update(alerts).set({ readAt: new Date() }).where(isNull(alerts.readAt));
  revalidatePath("/", "layout");
}

export async function markAlertReadAction(id: string) {
  await requireUser();
  await db.update(alerts).set({ readAt: new Date() }).where(eq(alerts.id, id));
  revalidatePath("/", "layout");
}
