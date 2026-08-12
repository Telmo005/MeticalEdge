import type { Instrumentation } from "next";

/**
 * Hook global do Next.js — corre para praticamente qualquer erro não
 * tratado em Server Components, route handlers e server actions, sem
 * precisar de try/catch manual em cada função. É o que faz "qualquer erro
 * quero ser notificado" funcionar sem espalhar chamadas a logError por
 * todo o código.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logError } = await import("@/lib/errorLog");
  await logError(context.routePath || request.path, error, {
    method: request.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
  });
};
