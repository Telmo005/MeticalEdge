import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const EXCHANGE_LABEL: Record<string, string> = { binance: "Binance", bybit: "Bybit" };

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/** Saúde da ligação a uma exchange — latência da última chamada, quando
 *  foi a última vez que funcionou, e o último erro se houver algum
 *  recente. Sem isto, uma exchange lenta ou a falhar só se nota quando o
 *  worker já parou de encontrar oportunidades. */
export function ExchangeHealthCard({
  exchangeId,
  lastSuccessAt,
  lastErrorAt,
  lastErrorMessage,
  avgLatencyMs,
}: {
  exchangeId: string;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  avgLatencyMs: number | null;
}) {
  const hasRecentError = lastErrorAt && (!lastSuccessAt || lastErrorAt > lastSuccessAt);
  const tone = hasRecentError ? "critical" : lastSuccessAt ? "good" : "neutral";
  const label = hasRecentError ? "com erro" : lastSuccessAt ? "ligado" : "sem dados";

  return (
    <Card>
      <CardLabel>{EXCHANGE_LABEL[exchangeId] ?? exchangeId}</CardLabel>
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {avgLatencyMs !== null ? <>latência {avgLatencyMs}ms · </> : null}
        {lastSuccessAt ? `última resposta há ${timeAgo(new Date(lastSuccessAt))}` : "ainda sem chamadas"}
      </p>
      {hasRecentError && lastErrorMessage ? (
        <p className="mt-1 text-[10px] text-[var(--critical)]">{lastErrorMessage.slice(0, 120)}</p>
      ) : null}
    </Card>
  );
}
