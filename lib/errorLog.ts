import "server-only";
import { db } from "@/db";
import { errorLogs } from "@/db/schema";
import { sendPush } from "@/lib/messaging-client";

/**
 * Grava qualquer erro do lado do servidor em error_logs e avisa por push —
 * chamado automaticamente por instrumentation.ts (onRequestError) para
 * praticamente todos os erros não tratados em Server Components, rotas e
 * server actions, sem precisar de try/catch espalhado pelo código.
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
