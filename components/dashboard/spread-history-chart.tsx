import { formatPct } from "@/lib/utils";

type SpreadPoint = { detectedAt: Date; netPct: number };
type Series = { pair: string; points: SpreadPoint[] };

const COLORS = ["var(--accent-2)", "var(--good)", "var(--warning)", "var(--accent)", "var(--critical)"];

/** Gráfico de linhas (SVG à mão, sem dependências, mesmo padrão do
 *  `capital-chart.tsx`) — margem líquida por par ao longo do tempo, a
 *  partir de `opportunities.netPct` já guardado a cada avaliação. Ajuda a
 *  ver visualmente qual par tem rotas de arbitragem mais consistentes. */
export function SpreadHistoryChart({ series }: { series: Series[] }) {
  const withData = series.filter((s) => s.points.length >= 2);
  if (withData.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Ainda não há histórico suficiente por par — deixa o worker correr mais um pouco.
      </p>
    );
  }

  const width = 640;
  const height = 180;
  const padding = 28;

  const allTimes = withData.flatMap((s) => s.points.map((p) => p.detectedAt.getTime()));
  const allValues = withData.flatMap((s) => s.points.map((p) => p.netPct));
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes) || minTime + 1;
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(...allValues, 0.01);
  const valueRange = maxValue - minValue || 1;
  const timeRange = maxTime - minTime || 1;

  const zeroY = height - padding - ((0 - minValue) / valueRange) * (height - padding * 2);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Margem líquida por par ao longo do tempo">
        <title>Margem líquida por par ao longo do tempo</title>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" />
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="var(--border)" strokeDasharray="3,3" />
        {withData.map((s, i) => {
          const points = s.points.map((p) => ({
            x: padding + ((p.detectedAt.getTime() - minTime) / timeRange) * (width - padding * 2),
            y: height - padding - ((p.netPct - minValue) / valueRange) * (height - padding * 2),
          }));
          const path = points.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          return <path key={s.pair} d={path} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="1.75" />;
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {withData.map((s, i) => {
          const last = s.points[s.points.length - 1];
          return (
            <span key={s.pair} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="font-medium">{s.pair}</span>
              <span className="tabular text-[var(--muted)]">{formatPct(last.netPct)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
