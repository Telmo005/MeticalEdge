import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMzn, cn } from "@/lib/utils";
import type { PriceExtremes, ReferenceDivergenceSignal } from "@/lib/p2p/price-intelligence";
import type { TopAdLifecycleSignal } from "@/lib/p2p/ad-lifecycle";

const EPSILON = 0.01;
const MIN_SAMPLES = 30;
const DIVERGENCE_MIN_SAMPLES = 180;
const DIVERGENCE_Z_THRESHOLD = 1.5;

function LifecycleBadge({ signal }: { signal: TopAdLifecycleSignal }) {
  if (signal.kind === "new") {
    return <Badge tone="good">Anúncio novo — pode não durar</Badge>;
  }
  if (signal.kind === "stale") {
    return <Badge tone="warning">Parado há {signal.streakMinutes} min — pode estar desactualizado</Badge>;
  }
  return null;
}

/**
 * Traduz o histórico de preços (já guardado a cada varredura) em respostas
 * simples — "é bom momento para comprar?", "é bom momento para vender?",
 * "este anúncio ainda é fiável?" — sem tabelas nem gráficos. São as mesmas
 * comparações que disparam os alertas de push em lib/p2p/scan.ts, só que
 * sempre visíveis aqui dentro, mesmo sem notificação nova.
 */
export function MarketIntelligenceCard({
  bestAsk,
  bestBid,
  extremes,
  askLifecycle,
  bidLifecycle,
  divergence,
}: {
  bestAsk: number | null;
  bestBid: number | null;
  extremes: PriceExtremes;
  askLifecycle?: TopAdLifecycleSignal;
  bidLifecycle?: TopAdLifecycleSignal;
  divergence?: ReferenceDivergenceSignal;
}) {
  const hasHistory = extremes.sampleCount >= MIN_SAMPLES;
  const atLow = hasHistory && bestAsk !== null && extremes.minAsk !== null && bestAsk <= extremes.minAsk + EPSILON;
  const atHigh = hasHistory && bestBid !== null && extremes.maxBid !== null && bestBid >= extremes.maxBid - EPSILON;

  const askDivergent =
    divergence &&
    divergence.sampleCount >= DIVERGENCE_MIN_SAMPLES &&
    divergence.askPremiumZScore !== null &&
    Math.abs(divergence.askPremiumZScore) >= DIVERGENCE_Z_THRESHOLD;
  const bidDivergent =
    divergence &&
    divergence.sampleCount >= DIVERGENCE_MIN_SAMPLES &&
    divergence.bidDiscountZScore !== null &&
    Math.abs(divergence.bidDiscountZScore) >= DIVERGENCE_Z_THRESHOLD;

  const highlighted = atLow || atHigh || askLifecycle?.kind === "new" || bidLifecycle?.kind === "new";

  return (
    <Card className={cn(highlighted ? "border-l-4 border-l-[var(--good)]" : undefined)}>
      <CardTitle className="text-base">Inteligência de mercado</CardTitle>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Compara o preço de agora com o histórico já guardado — não precisas de calcular nada, só ver o sinal.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-[var(--surface-2)] p-3">
          <CardLabel>Comprar USDT agora</CardLabel>
          <div className="tabular text-lg font-semibold">{formatMzn(bestAsk)}</div>
          <div className="mt-1 flex flex-col gap-1">
            {!hasHistory ? (
              <p className="text-xs text-[var(--muted)]">ainda a acumular histórico de preços</p>
            ) : atLow ? (
              <Badge tone="good">Preço mais baixo dos últimos {extremes.windowDays} dias — bom para comprar</Badge>
            ) : (
              <p className="text-xs text-[var(--muted)]">mínimo recente: {formatMzn(extremes.minAsk)}</p>
            )}
            {askLifecycle ? <LifecycleBadge signal={askLifecycle} /> : null}
            {askDivergent ? <Badge tone="warning">Desvio incomum vs. preço de referência</Badge> : null}
          </div>
        </div>
        <div className="rounded-md bg-[var(--surface-2)] p-3">
          <CardLabel>Vender USDT agora</CardLabel>
          <div className="tabular text-lg font-semibold">{formatMzn(bestBid)}</div>
          <div className="mt-1 flex flex-col gap-1">
            {!hasHistory ? (
              <p className="text-xs text-[var(--muted)]">ainda a acumular histórico de preços</p>
            ) : atHigh ? (
              <Badge tone="good">Preço mais alto dos últimos {extremes.windowDays} dias — bom para vender</Badge>
            ) : (
              <p className="text-xs text-[var(--muted)]">máximo recente: {formatMzn(extremes.maxBid)}</p>
            )}
            {bidLifecycle ? <LifecycleBadge signal={bidLifecycle} /> : null}
            {bidDivergent ? <Badge tone="warning">Desvio incomum vs. preço de referência</Badge> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
