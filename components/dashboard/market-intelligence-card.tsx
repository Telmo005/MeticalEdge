import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMzn, cn } from "@/lib/utils";
import type { PriceExtremes } from "@/lib/p2p/price-intelligence";

const EPSILON = 0.01;
const MIN_SAMPLES = 30;

/**
 * Traduz o histórico de preços (já guardado a cada varredura) em duas
 * respostas simples — "é bom momento para comprar?" / "é bom momento para
 * vender?" — sem tabelas nem gráficos. É a mesma comparação que dispara os
 * alertas de push em lib/p2p/scan.ts, só que sempre visível aqui dentro.
 */
export function MarketIntelligenceCard({
  bestAsk,
  bestBid,
  extremes,
}: {
  bestAsk: number | null;
  bestBid: number | null;
  extremes: PriceExtremes;
}) {
  const hasHistory = extremes.sampleCount >= MIN_SAMPLES;
  const atLow = hasHistory && bestAsk !== null && extremes.minAsk !== null && bestAsk <= extremes.minAsk + EPSILON;
  const atHigh = hasHistory && bestBid !== null && extremes.maxBid !== null && bestBid >= extremes.maxBid - EPSILON;

  return (
    <Card className={cn(atLow || atHigh ? "border-l-4 border-l-[var(--good)]" : undefined)}>
      <CardTitle className="text-base">Inteligência de mercado</CardTitle>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Compara o preço de agora com os últimos {extremes.windowDays} dias — não precisas de calcular nada,
        só ver o sinal.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-[var(--surface-2)] p-3">
          <CardLabel>Comprar USDT agora</CardLabel>
          <div className="tabular text-lg font-semibold">{formatMzn(bestAsk)}</div>
          {!hasHistory ? (
            <p className="mt-1 text-xs text-[var(--muted)]">ainda a acumular histórico de preços</p>
          ) : atLow ? (
            <Badge tone="good">Preço mais baixo dos últimos {extremes.windowDays} dias — bom para comprar</Badge>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">mínimo recente: {formatMzn(extremes.minAsk)}</p>
          )}
        </div>
        <div className="rounded-md bg-[var(--surface-2)] p-3">
          <CardLabel>Vender USDT agora</CardLabel>
          <div className="tabular text-lg font-semibold">{formatMzn(bestBid)}</div>
          {!hasHistory ? (
            <p className="mt-1 text-xs text-[var(--muted)]">ainda a acumular histórico de preços</p>
          ) : atHigh ? (
            <Badge tone="good">Preço mais alto dos últimos {extremes.windowDays} dias — bom para vender</Badge>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">máximo recente: {formatMzn(extremes.maxBid)}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
