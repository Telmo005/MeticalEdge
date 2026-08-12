import { Card, CardLabel } from "@/components/ui/card";
import { formatMzn } from "@/lib/utils";
import type { PricePoint } from "@/lib/p2p/price-intelligence";

/** Constrói o "d" de um <path> em segmentos separados por valores em falta —
 *  uma lacuna no histórico não deve desenhar uma linha reta a atravessá-la. */
function buildLinePath(points: PricePoint[], pick: (p: PricePoint) => number | null, x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let drawing = false;
  points.forEach((p, i) => {
    const v = pick(p);
    if (v === null) {
      drawing = false;
      return;
    }
    d += `${drawing ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    drawing = true;
  });
  return d.trim();
}

/** Gráfico simples do preço nas últimas horas — para responder "subiu ou
 *  desceu?" com um olhar, sem precisar de esperar por uma notificação nem
 *  de abrir a lista de comerciantes. Duas linhas: o melhor preço para
 *  comprar e o melhor preço para vender, na mesma escala (é a mesma
 *  unidade, MZN por USDT). */
export function PriceHistoryChart({ points, hours = 24 }: { points: PricePoint[]; hours?: number }) {
  const usable = points.filter((p) => p.bestAsk !== null || p.bestBid !== null);

  if (usable.length < 2) {
    return (
      <Card>
        <CardLabel>Preço nas últimas {hours}h</CardLabel>
        <p className="text-sm text-[var(--muted)]">Ainda não há histórico suficiente para desenhar o gráfico.</p>
      </Card>
    );
  }

  const width = 640;
  const height = 220;
  const padding = 36;

  const allValues = usable.flatMap((p) => [p.bestAsk, p.bestBid]).filter((v): v is number => v !== null);
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const span = Math.max(maxV - minV, 0.01);

  const first = usable[0].collectedAt.getTime();
  const last = usable[usable.length - 1].collectedAt.getTime();
  const timeSpan = Math.max(last - first, 1);

  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  function x(i: number) {
    const t = usable[i].collectedAt.getTime();
    return padding + ((t - first) / timeSpan) * plotW;
  }
  function y(v: number) {
    return padding + plotH - ((v - minV) / span) * plotH;
  }

  const askPath = buildLinePath(usable, (p) => p.bestAsk, x, y);
  const bidPath = buildLinePath(usable, (p) => p.bestBid, x, y);

  const lastAsk = [...usable].reverse().find((p) => p.bestAsk !== null)?.bestAsk ?? null;
  const lastBid = [...usable].reverse().find((p) => p.bestBid !== null)?.bestBid ?? null;

  const timeFmt = (ms: number) => new Date(ms).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <CardLabel className="mb-0">Preço nas últimas {hours}h</CardLabel>
        <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
            Comprar {lastAsk !== null ? `(${formatMzn(lastAsk)})` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent-2)" }} />
            Vender {lastBid !== null ? `(${formatMzn(lastBid)})` : ""}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`Preço de compra e venda nas últimas ${hours} horas`}>
        <title>Melhor preço de compra e de venda ao longo do tempo</title>
        <path d={askPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <path d={bidPath} fill="none" stroke="var(--accent-2)" strokeWidth={2} />
        <text x={padding} y={height - 10} textAnchor="start" fontSize="10" fill="var(--muted)">
          {timeFmt(first)}
        </text>
        <text x={width - padding} y={height - 10} textAnchor="end" fontSize="10" fill="var(--muted)">
          {timeFmt(last)}
        </text>
      </svg>
    </Card>
  );
}
