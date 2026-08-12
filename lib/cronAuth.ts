import { timingSafeEqual } from "node:crypto";

/**
 * Protege /api/cron/* — mesma comparação em tempo constante do Duelo:
 * (1) se CRON_SECRET não estiver definido, nunca autoriza (evita o bug de
 * "Bearer undefined" autorizar qualquer chamador); (2) timingSafeEqual em
 * vez de !== para não vazar quantos bytes iniciais bateram.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // .trim() porque schedulers externos (cron-job.org, etc.) às vezes
  // acrescentam um espaço ou quebra de linha ao colar o valor do header —
  // isso não deve ser motivo para um 401 silencioso.
  const authHeader = (request.headers.get("authorization") ?? "").trim();
  const expected = `Bearer ${secret.trim()}`;

  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
