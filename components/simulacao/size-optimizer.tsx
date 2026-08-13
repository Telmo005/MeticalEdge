import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatMzn, formatPct } from "@/lib/utils";
import type { OptimalSize } from "@/lib/p2p/optimizer";

const W = 720;
const H = 200;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 24;

/**
 * Lucro em função do tamanho da operação.
 *
 * A app assumia que operar com todo o capital era sempre o melhor. Não é: a
 * taxa da Binance é fixa por ordem e os anúncios têm limites, o que torna
 * esta curva serrilhada em vez de crescente. Há degraus onde acrescentar
 * 200 MZN obriga a uma ordem extra e faz o lucro CAIR. Ver a curva torna
 * isso óbvio sem precisar de explicação.
 */
export function SizeOptimizer({
  optimal,
  configuredMzn,
}: {
  optimal: OptimalSize;
  configuredMzn: number;
}) {
  const { curve, bestAbsolute, bestRoi, atConfigured } = optimal;

  if (curve.length < 3 || !bestAbsolute) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">
          Ainda não há anúncios em quantidade suficiente na última varredura para valer a pena comparar
          tamanhos de operação.
        </p>
      </Card>
    );
  }

  const gain = atConfigured ? bestAbsolute.netMzn - atConfigured.netMzn : 0;
  const worthSwitching = gain > 0.5 && Math.abs(bestAbsolute.capitalMzn - configuredMzn) > 1;

  const xs = curve.map((p) => p.capitalMzn);
  const ys = curve.map((p) => p.netMzn);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(0, ...ys);
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const px = (v: number) => PAD_L + ((v - xMin) / xSpan) * (W - PAD_L - PAD_R);
  const py = (v: number) => PAD_T + (1 - (v - yMin) / ySpan) * (H - PAD_T - PAD_B);

  const line = curve
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(p.capitalMzn).toFixed(1)},${py(p.netMzn).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${px(xMax).toFixed(1)},${py(Math.max(0, yMin)).toFixed(1)} L${px(xMin).toFixed(1)},${py(Math.max(0, yMin)).toFixed(1)} Z`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className={cn(worthSwitching && "border-l-4 border-l-[var(--good)]")}>
          <CardLabel>Rende mais dinheiro</CardLabel>
          <div className="tabular text-xl font-bold text-[var(--good)]">
            +{formatMzn(bestAbsolute.netMzn)}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            operando {formatMzn(bestAbsolute.capitalMzn)} · {bestAbsolute.nOrders}{" "}
            {bestAbsolute.nOrders === 1 ? "ordem" : "ordens"}
          </p>
        </Card>

        <Card>
          <CardLabel>Melhor rendimento</CardLabel>
          <div className="tabular text-xl font-bold text-[var(--accent-2)]">{formatPct(bestRoi?.netPct)}</div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            operando {formatMzn(bestRoi?.capitalMzn ?? 0)} — rende mais por Metical, mas dá menos dinheiro no
            total
          </p>
        </Card>

        <Card>
          <CardLabel>Com o teu valor actual</CardLabel>
          <div
            className={cn(
              "tabular text-xl font-bold",
              (atConfigured?.netMzn ?? 0) > 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
            )}
          >
            {(atConfigured?.netMzn ?? 0) > 0 ? "+" : ""}
            {formatMzn(atConfigured?.netMzn ?? 0)}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">operando {formatMzn(configuredMzn)}</p>
        </Card>
      </div>

      {worthSwitching ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-[var(--good-bg)] px-3 py-2 text-sm text-[var(--good)]">
          <Badge tone="good">ganho possível</Badge>
          <span>
            Operar {formatMzn(bestAbsolute.capitalMzn)} em vez de {formatMzn(configuredMzn)} rende mais{" "}
            <b className="tabular">{formatMzn(gain)}</b> nesta mesma janela de mercado.
          </span>
        </div>
      ) : null}

      <Card>
        <CardTitle>Lucro conforme o tamanho da operação</CardTitle>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cada queda brusca na linha é o momento em que o valor deixa de caber nos anúncios já usados e
          obriga a mais uma ordem — e mais uma taxa fixa. É por isso que operar mais nem sempre rende mais.
        </p>

        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full min-w-[520px]" role="img">
            <defs>
              <linearGradient id="sizeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--good)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--good)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {yMin < 0 ? (
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={py(0)}
                y2={py(0)}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
            ) : null}

            <path d={area} fill="url(#sizeFill)" />
            <path d={line} fill="none" stroke="var(--good)" strokeWidth={2} strokeLinejoin="round" />

            <line
              x1={px(bestAbsolute.capitalMzn)}
              x2={px(bestAbsolute.capitalMzn)}
              y1={PAD_T}
              y2={H - PAD_B}
              stroke="var(--good)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <circle cx={px(bestAbsolute.capitalMzn)} cy={py(bestAbsolute.netMzn)} r={5} fill="var(--good)" />

            {atConfigured ? (
              <circle
                cx={px(atConfigured.capitalMzn)}
                cy={py(atConfigured.netMzn)}
                r={4}
                fill="var(--surface)"
                stroke="var(--accent)"
                strokeWidth={2}
              />
            ) : null}

            <text x={PAD_L} y={H - 8} fill="var(--muted)" fontSize={11}>
              {formatMzn(xMin)}
            </text>
            <text x={W - PAD_R} y={H - 8} fill="var(--muted)" fontSize={11} textAnchor="end">
              {formatMzn(xMax)}
            </text>
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--good)]" />
            tamanho óptimo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-[var(--accent)] bg-[var(--surface)]" />
            o teu valor
          </span>
        </div>
      </Card>
    </div>
  );
}
