import { CardLabel } from "@/components/ui/card";
import { formatMzn, cn } from "@/lib/utils";

function tone(v: number): "good" | "critical" {
  return v >= 0 ? "good" : "critical";
}

/**
 * Substitui os 3 cartões soltos (conservador/médio/optimista) por uma única
 * barra — os três números só diferem pela taxa por ordem que a Binance
 * cobra (não é pública ao certo, por isso um intervalo), não são três
 * previsões independentes. Uma barra deixa ver de imediato se a operação
 * está em prejuízo mesmo no melhor cenário, ou se só o pior cenário é que
 * preocupa — sem precisar de comparar três números de cabeça.
 */
export function ScenarioRange({
  conservadorMzn,
  medioMzn,
  otimistaMzn,
}: {
  conservadorMzn: number;
  medioMzn: number;
  otimistaMzn: number;
}) {
  const domainMin = Math.min(conservadorMzn, 0);
  const domainMax = Math.max(otimistaMzn, 0);
  const span = Math.max(domainMax - domainMin, 0.01);
  const pad = span * 0.12;
  const lo = domainMin - pad;
  const hi = domainMax + pad;
  const fullSpan = hi - lo;

  const pct = (v: number) => `${(((v - lo) / fullSpan) * 100).toFixed(2)}%`;

  const barTone = tone(medioMzn);

  return (
    <div>
      <CardLabel className="mb-0">Intervalo de lucro líquido esperado</CardLabel>
      <p className="mb-4 mt-1 text-xs text-[var(--muted)]">
        Os três cenários só variam pela taxa que a Binance cobra por ordem (não é pública ao certo) — não são
        três previsões diferentes, é o mesmo negócio visto pelo pior e pelo melhor lado.
      </p>

      <div className="relative mb-1 h-2 rounded-full bg-[var(--surface-2)]">
        <div
          className={cn(
            "absolute top-0 h-2 rounded-full",
            barTone === "good" ? "bg-[var(--good)]" : "bg-[var(--critical)]"
          )}
          style={{ left: pct(conservadorMzn), right: `calc(100% - ${pct(otimistaMzn)})` }}
        />
        <div className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-[var(--muted)]" style={{ left: pct(0) }} />
        <div
          className={cn(
            "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)]",
            barTone === "good" ? "bg-[var(--good)]" : "bg-[var(--critical)]"
          )}
          style={{ left: pct(medioMzn) }}
        />
      </div>

      <div className="mb-4 grid grid-cols-3 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Conservador</div>
          <div className={cn("tabular text-sm font-semibold", tone(conservadorMzn) === "good" ? "text-[var(--good)]" : "text-[var(--critical)]")}>
            {formatMzn(conservadorMzn)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Médio (mais provável)</div>
          <div className={cn("tabular text-lg font-bold", tone(medioMzn) === "good" ? "text-[var(--good)]" : "text-[var(--critical)]")}>
            {formatMzn(medioMzn)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Optimista</div>
          <div className={cn("tabular text-sm font-semibold", tone(otimistaMzn) === "good" ? "text-[var(--good)]" : "text-[var(--critical)]")}>
            {formatMzn(otimistaMzn)}
          </div>
        </div>
      </div>
    </div>
  );
}
