import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { alerts, errorLogs } from "@/db/schema";
import { sendPush } from "@/lib/messaging-client";

/** Um erro repetido em rajada (ex.: um processo preso a tentar a mesma
 *  query partida vezes seguidas) nunca deve inundar o sino de notificações
 *  nem o telemóvel — um alerta novo só dispara se não houver já um alerta
 *  de "erro" da mesma fonte dentro deste intervalo. `error_logs` continua
 *  sempre a guardar o histórico completo, sem dedup nenhum. */
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Implementação sem `import "server-only"` — esse guard só resolve dentro
 * do bundler do Next.js (fora dele, ex. o worker corrido via `tsx`, lança
 * "This module cannot be imported..." sempre, mesmo em contexto de
 * servidor). lib/errorLog.ts reexporta isto com o guard para o lado
 * Next.js; o worker importa directamente daqui.
 *
 * Nunca lança — um erro a registar o erro não pode derrubar mais nada.
 * Deliberadamente NÃO usa logError dentro de sendPush (ver
 * lib/messaging-client.ts): evitaria uma recursão push-falha -> regista
 * erro -> tenta push -> falha -> regista erro -> ...
 */
export async function logError(source: string, error: unknown, details?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? null) : null;

  try {
    await db.insert(errorLogs).values({
      source,
      message: message.slice(0, 2000),
      details: details ?? null,
      stack: stack?.slice(0, 4000) ?? null,
    });
  } catch (dbErr) {
    console.error("logError: falhou a gravar em error_logs", dbErr);
  }

  // Segundo canal (além do push) que fica sempre visível dentro da própria
  // app — o push é um serviço externo e pode falhar/ser silenciado sem
  // ninguém reparar; o sino de notificações nunca depende de mais nada.
  const title = `Erro: ${source}`;
  try {
    const since = new Date(Date.now() - ALERT_COOLDOWN_MS);
    const [recent] = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(and(eq(alerts.kind, "erro"), eq(alerts.title, title), gte(alerts.sentAt, since)))
      .limit(1);

    if (!recent) {
      await db.insert(alerts).values({ kind: "erro", title, body: message.slice(0, 500) });
      await sendPush(title, message.slice(0, 400));
    }
  } catch (alertErr) {
    console.error("logError: falhou a gravar alerta/push", alertErr);
  }
}
