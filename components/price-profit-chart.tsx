import { Card, CardLabel } from "@/components/ui/card";
import { formatMzn } from "@/lib/utils";

export type PricePoint = { capital: number; buyPrice: number; netMzn: number };

/** Gráfico linear simples: à medida que compras mais fundo no livro (mais
 *  capital), o preço médio de compra sobe a partir do preço mais barato —
 *  isto mostra, de forma directa, como isso muda o lucro. Sem nada para
 *  calcular: só ver a linha a subir ou a descer. */
export function PriceProfitChart({ points, highlightCapital }: { points: PricePoint[]; highlightCapital: number }) {
  const sorted = [...points].sort((a, b) => a.buyPrice - b.buyPrice);
  const width = 640;
  const height = 260;
  const padding = 40;

  const prices = sorted.map((p) => p.buyPrice);
  const profits = sorted.map((p) => p.netMzn);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSpan = Math.max(maxPrice - minPrice, 0.01);
  const maxAbsProfit = Math.max(...profits.map((v) => Math.abs(v)), 1);

  const plotW = width - padding * 2;
  const plotH = height - padding * 2;
  const zeroY = padding + plotH * (maxAbsProfit / (maxAbsProfit * 2));

  function xFor(price: number) {
    return padding + ((price - minPrice) / priceSpan) * plotW;
  }
  function yFor(profit: number) {
    return zeroY - (profit / maxAbsProfit) * (plotH / 2);
  }

  const linePath = sorted
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.buyPrice).toFixed(1)} ${yFor(p.netMzn).toFixed(1)}`)
    .join(" ");

  const cheapest = sorted[0];
  const priciest = sorted[sorted.length - 1];

  return (
    <Card>
      <CardLabel>Preço médio de compra vs. lucro líquido</CardLabel>
      <p className="mb-3 mt-1 text-xs text-[var(--muted)]">
        Da esquerda (preço mais barato, capital menor) para a direita (compras mais fundo no livro, preço
        médio mais alto). A linha mostra o que acontece ao lucro à medida que avanças.
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Preço médio de compra vs lucro líquido">
        <title>Preço médio de compra vs lucro líquido por escalão de capital</title>
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="var(--border)" />
        <path d={linePath} fill="none" stroke="var(--accent-2)" strokeWidth={2} />
        {sorted.map((p) => {
          const isHighlight = p.capital === highlightCapital;
          const isProfit = p.netMzn >= 0;
          return (
            <g key={p.capital}>
              <circle
                cx={xFor(p.buyPrice)}
                cy={yFor(p.netMzn)}
                r={isHighlight ? 5 : 3.5}
                fill={isProfit ? "var(--good)" : "var(--critical)"}
                stroke="var(--surface)"
                strokeWidth={isHighlight ? 2 : 1}
              />
              {isHighlight ? (
                <text
                  x={xFor(p.buyPrice)}
                  y={yFor(p.netMzn) - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={700}
                  fill="var(--foreground)"
                >
                  {formatMzn(p.netMzn)}
                </text>
              ) : null}
            </g>
          );
        })}
        <text x={xFor(cheapest.buyPrice)} y={height - padding + 16} textAnchor="start" fontSize="10" fill="var(--muted)">
          {formatMzn(cheapest.buyPrice)} (mais barato)
        </text>
        <text x={xFor(priciest.buyPrice)} y={height - padding + 16} textAnchor="end" fontSize="10" fill="var(--muted)">
          {formatMzn(priciest.buyPrice)}
        </text>
      </svg>
    </Card>
  );
}
