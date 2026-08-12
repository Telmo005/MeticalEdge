import { Badge } from "@/components/ui/badge";
import { formatMzn, formatUsdt } from "@/lib/utils";

export type PlanStep = {
  advNo?: string;
  merchantName: string;
  merchantId?: string;
  price: number;
  mznUsed: number;
  usdtAmount: number;
  monthOrders: number | null;
  monthFinishRate: number | null;
};

function reputationTone(finishRate: number | null, orders: number | null): "good" | "warning" | "critical" {
  if (finishRate === null || orders === null) return "warning";
  if (finishRate >= 0.97 && orders >= 200) return "good";
  if (finishRate >= 0.95 && orders >= 50) return "warning";
  return "critical";
}

function StepRow({ step, index }: { step: PlanStep; index: number }) {
  const tone = reputationTone(step.monthFinishRate, step.monthOrders);
  return (
    <li className="flex items-start gap-3 rounded-md bg-[var(--surface-2)] p-3">
      <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-2)] text-xs font-bold text-white">
        {index}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {step.merchantName}
          <span className="ml-2 text-[var(--muted)] font-normal">
            {formatUsdt(step.usdtAmount)} a {formatMzn(step.price)}/USDT
          </span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <Badge tone={tone}>
            {step.monthOrders ?? "?"} ordens/mês · {((step.monthFinishRate ?? 0) * 100).toFixed(0)}% conclusão
          </Badge>
        </div>
      </div>
      <div className="tabular text-right text-sm font-semibold">{formatMzn(step.mznUsed)}</div>
    </li>
  );
}

/** Instruções passo-a-passo em linguagem simples: de quem comprar, a quem
 *  vender, e quanto — para quem não conhece o mercado P2P conseguir
 *  executar sem interpretar números soltos. */
export function ExecutionPlan({ buySteps, sellSteps }: { buySteps: PlanStep[]; sellSteps: PlanStep[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Passo 1 — Compra USDT (nesta ordem)
        </p>
        {buySteps.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sem execução possível.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {buySteps.map((s, i) => (
              <StepRow key={s.advNo ?? i} step={s} index={i + 1} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Passo 2 — Vende o USDT comprado (nesta ordem)
        </p>
        {sellSteps.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sem execução possível.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sellSteps.map((s, i) => (
              <StepRow key={s.advNo ?? i} step={s} index={i + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
