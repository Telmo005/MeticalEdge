import { formatUsdt } from "@/lib/utils";

type Point = { changedAt: Date; resultingBalanceUsdt: number };

/** Gráfico de linha simples (SVG, sem dependências) da evolução do saldo
 *  real ao longo do tempo — lê directamente do histórico já guardado em
 *  capital_ledger (secção 14: nunca uma projecção, só o saldo real
 *  registado). */
export function CapitalChart({ history }: { history: Point[] }) {
  if (history.length < 2) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Ainda não há histórico suficiente para desenhar um gráfico — regista o saldo inicial e deixa o robô operar.
      </p>
    );
  }

  const width = 640;
  const height = 160;
  const padding = 28;

  const values = history.map((h) => h.resultingBalanceUsdt);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (width - padding * 2);
    const y = height - padding - ((h.resultingBalanceUsdt - min) / range) * (height - padding * 2);
    return { x, y, value: h.resultingBalanceUsdt };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const trendUp = last.value >= first.value;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Evolução do saldo">
        <title>Evolução do saldo real ao longo do tempo</title>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" />
        <path d={path} fill="none" stroke={trendUp ? "var(--good)" : "var(--critical)"} strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3.5 : 2} fill={trendUp ? "var(--good)" : "var(--critical)"} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
        <span>{formatUsdt(min)}</span>
        <span className="tabular font-semibold text-[var(--foreground)]">{formatUsdt(last.value)} (actual)</span>
        <span>{formatUsdt(max)}</span>
      </div>
    </div>
  );
}
