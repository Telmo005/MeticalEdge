/**
 * Cliente para o gateway de mensagens partilhado (o mesmo "payment gateway"
 * que o Duelo usa) — SMS + push Android para o telemóvel do dono do sistema
 * via celular-gateway. Ver docs/ENDPOINTS.md desse repo: os endpoints de
 * mensagens autenticam com o próprio CRON_SECRET do gateway (não é uma
 * chave por-app como a de pagamentos), por isso MESSAGING_API_KEY aqui é
 * literalmente uma cópia do CRON_SECRET do gateway.
 *
 * Env vars (só servidor — nunca expor ao cliente):
 *   MESSAGING_BASE_URL = URL do gateway (PUBLIC_BASE_URL desse projecto)
 *   MESSAGING_API_KEY  = CRON_SECRET desse projecto
 */
type SendResult = { ok: true; id: string } | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 8_000;

function config(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.MESSAGING_BASE_URL;
  const apiKey = process.env.MESSAGING_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

const APP_NAME = "MeticalEdge";

/**
 * Push Android para o dono do sistema (não é por-utilizador — este endpoint
 * não tem `to`). Nunca lança excepção: uma falha no gateway de mensagens
 * nunca deve derrubar a varredura de mercado que a chamou.
 */
export async function sendPush(subject: string, description: string): Promise<SendResult> {
  const cfg = config();
  const body = `${subject}\n\n${description}`;
  if (!cfg) {
    console.error("sendPush: MESSAGING_BASE_URL/MESSAGING_API_KEY não configurados, a ignorar", { subject });
    return { ok: false, error: "MESSAGING_BASE_URL/MESSAGING_API_KEY não configurados" };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/api/internal/messages/push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: APP_NAME, body: body.slice(0, 500) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.id) {
      const text = JSON.stringify(json);
      console.error(`sendPush falhou: ${res.status} ${text}`, { subject });
      return { ok: false, error: `sendPush falhou: ${res.status} ${text}` };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    console.error("sendPush: fetch falhou", { subject, err });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * SMS real, canal duplicado ao push para o caso de o telemóvel não estar
 * a receber notificações (app fechada, sem dados). `to` tem de estar em
 * E.164 (+258...) — ver settings.alertPhoneE164. Nunca lança excepção.
 */
export async function sendSms(to: string, message: string): Promise<SendResult> {
  const cfg = config();
  if (!cfg) {
    console.error("sendSms: MESSAGING_BASE_URL/MESSAGING_API_KEY não configurados, a ignorar", { to });
    return { ok: false, error: "MESSAGING_BASE_URL/MESSAGING_API_KEY não configurados" };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/api/internal/messages/sms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, message: message.slice(0, 1000) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.id) {
      const text = JSON.stringify(json);
      console.error(`sendSms falhou: ${res.status} ${text}`, { to });
      return { ok: false, error: `sendSms falhou: ${res.status} ${text}` };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    console.error("sendSms: fetch falhou", { to, err });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
