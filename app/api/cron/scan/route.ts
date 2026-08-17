import { NextResponse } from "next/server";
import { gte, and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { getHeartbeat, getBotSettings } from "@/lib/queries";
import { sendPush } from "@/lib/messaging-client";

export const maxDuration = 30;

/** Não faz mais nenhuma varredura — isso agora é o worker sempre-ligado
 *  (ver worker/index.ts). Esta rota passou a ser só um heartbeat-check:
 *  chamada por um scheduler externo (cron-job.org, mesmo de sempre) a cada
 *  minuto, confirma que o worker ainda está vivo e avisa se parou de
 *  responder — protecção contra "mercado instável"/falha silenciosa
 *  (secção 9). Cooldown de 15 min para não repetir o mesmo alerta a cada
 *  minuto enquanto o worker continuar em baixo. */
const STALE_AFTER_MS = 3 * 60 * 1000;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [heartbeat, settings] = await Promise.all([getHeartbeat(), getBotSettings()]);

  if (!heartbeat) {
    return NextResponse.json({ ok: false, reason: "sem heartbeat registado — worker nunca correu" });
  }

  const ageMs = Date.now() - new Date(heartbeat.at).getTime();
  const isStale = ageMs > STALE_AFTER_MS;
  const killSwitchOn = settings?.killSwitchEngaged ?? false;

  if (isStale && !killSwitchOn) {
    const since = new Date(Date.now() - ALERT_COOLDOWN_MS);
    const [recentAlert] = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.kind, "erro"), gte(alerts.sentAt, since)))
      .orderBy(desc(alerts.sentAt))
      .limit(1);

    if (!recentAlert) {
      const title = "Worker sem resposta";
      const body = `O worker não actualiza o heartbeat há ${Math.round(ageMs / 1000)}s. Confirma que o processo continua a correr no servidor.`;
      await sendPush(title, body);
      await db.insert(alerts).values({ kind: "erro", title, body });
    }
  }

  return NextResponse.json({ ok: true, isStale, killSwitchOn, ageMs, heartbeatStatus: heartbeat.status });
}
