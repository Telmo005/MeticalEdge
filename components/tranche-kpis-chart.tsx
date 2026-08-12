import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMzn, formatPct } from "@/lib/utils";

export type TrancheRow = {
  capital: number;
  netMzn: number;
  netPct: number;
  nOrders: number;
  fullyFilled: boolean;
};

function classify(netPctMedium: number, fullyFilled: boolean): { label: string; tone: "good" | "warning" | "critical" } {
  if (!fullyFilled) return { label: "Bloqueado", tone: "critical" };
  if (netPctMedium >= 0.3) return { label: "Viável", tone: "good" };
  if (netPctMedium > 0) return { label: "Marginal", tone: "warning" };
  return { label: "Não viável", tone: "critical" };
}

const TONE_COLOR: Record<"good" | "warning" | "critical", string> = {
  good: "var(--good)",
  warning: "var(--warning)",
  critical: "var(--critical)",
};

function TrancheBarChart({ rows, highlightCapital }: { rows: TrancheRow[]; highlightCapital: number }) {
  const width = 640;
  const height = 220;
  const padding = 32;
  const values = rows.map((r) => r.netMzn);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const zeroY = padding + (height - padding * 2) * (maxAbs / (maxAbs * 2));
  const barWidth = (width - padding * 2) / rows.length / 1.6;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Lucro líquido por capital">
      <title>Lucro líquido médio por escalão de capital</title>
      <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="var(--border)" />
      {rows.map((r, i) => {
        const c = classify(r.netPct, r.fullyFilled);
        const slot = (width - padding * 2) / rows.length;
        const cx = padding + slot * i + slot / 2;
        const barHeight = (Math.abs(r.netMzn) / maxAbs) * (height - padding * 2 - 20);
        const y = r.netMzn >= 0 ? zeroY - barHeight : zeroY;
        const isHighlight = r.capital === highlightCapital;
        return (
          <g key={r.capital}>
            <rect
              x={cx - barWidth / 2}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 1)}
              rx={2}
              fill={TONE_COLOR[c.tone]}
              opacity={isHighlight ? 1 : 0.55}
            />
            <text x={cx} y={height - padding + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {formatMzn(r.capital).replace(",00 MZN", "")}
            </text>
            <text
              x={cx}
              y={r.netMzn >= 0 ? y - 6 : y + barHeight + 14}
              textAnchor="middle"
              fontSize="10"
              fill="var(--foreground)"
              fontWeight={isHighlight ? 700 : 400}
            >
              {formatMzn(r.netMzn).replace(" MZN", "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Substitui a tabela crua de escalões por KPIs (o que realmente importa
 *  para decidir) + um gráfico de barras — mais rápido de ler do que uma
 *  tabela quando o que interessa é comparar, não auditar linha a linha
 *  (essa auditoria continua disponível na aba "Por comerciante"). */
export function TrancheKpisChart({ rows, chosenCapital }: { rows: TrancheRow[]; chosenCapital: number }) {
  const best = [...rows].sort((a, b) => b.netMzn - a.netMzn)[0];
  const bestRoi = [...rows].sort((a, b) => b.netPct - a.netPct)[0];
  const minViable = [...rows]
    .sort((a, b) => a.capital - b.capital)
    .find((r) => r.fullyFilled && r.netPct > 0);
  const current = rows.find((r) => r.capital === chosenCapital) ?? rows[0];
  const currentClass = classify(current.netPct, current.fullyFilled);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardLabel>Melhor lucro líquido</CardLabel>
          <div className="tabular text-lg font-semibold">{formatMzn(best.netMzn)}</div>
          <p className="text-xs text-[var(--muted)]">com {formatMzn(best.capital)}</p>
        </Card>
        <Card>
          <CardLabel>Melhor ROI</CardLabel>
          <div className="tabular text-lg font-semibold">{formatPct(bestRoi.netPct)}</div>
          <p className="text-xs text-[var(--muted)]">com {formatMzn(bestRoi.capital)}</p>
        </Card>
        <Card>
          <CardLabel>Capital mínimo viável</CardLabel>
          <div className="tabular text-lg font-semibold">
            {minViable ? formatMzn(minViable.capital) : "nenhum agora"}
          </div>
          <p className="text-xs text-[var(--muted)]">primeiro escalão com lucro líquido positivo</p>
        </Card>
        <Card>
          <CardLabel>O teu capital ({formatMzn(chosenCapital)})</CardLabel>
          <div className="tabular text-lg font-semibold">{formatMzn(current.netMzn)}</div>
          <Badge tone={currentClass.tone}>{currentClass.label}</Badge>
        </Card>
      </div>

      <Card>
        <CardLabel>Lucro líquido médio por escalão de capital</CardLabel>
        <TrancheBarChart rows={rows} highlightCapital={chosenCapital} />
      </Card>
    </div>
  );
}
