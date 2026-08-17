import { db } from "@/db";
import { errorLogs } from "@/db/schema";
import { sendPush } from "@/lib/messaging-client";

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

  await sendPush(`Erro: ${source}`, message.slice(0, 400));
}
