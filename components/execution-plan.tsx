import { Badge } from "@/components/ui/badge";
import { formatMzn, formatUsdt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { reputationTone, reputationLabel } from "@/lib/reputation";

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

function StepRow({ step, index, kind }: { step: PlanStep; index: number; kind: "spend" | "receive" }) {
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
            {reputationLabel(step.monthFinishRate, step.monthOrders)} · {step.monthOrders ?? "?"} ordens/mês ·{" "}
            {((step.monthFinishRate ?? 0) * 100).toFixed(0)}% conclusão
          </Badge>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          {kind === "spend" ? "gastas" : "recebes (bruto)"}
        </div>
        <div className="tabular text-sm font-semibold">{formatMzn(step.mznUsed)}</div>
      </div>
    </li>
  );
}

/** Instruções passo-a-passo em linguagem simples: de quem comprar, a quem
 *  vender, e quanto — para quem não conhece o mercado P2P conseguir
 *  executar sem interpretar números soltos. Cada valor diz claramente se é
 *  dinheiro que sai ("gastas") ou que entra ainda sem descontar taxas
 *  ("recebes bruto") — sem isto, o valor de venda parece o ganho final,
 *  quando só o resumo no fim (net) é que é. */
export function ExecutionPlan({
  buySteps,
  sellSteps,
  netMzn,
}: {
  buySteps: PlanStep[];
  sellSteps: PlanStep[];
  /** Se dado, mostra uma barra de resumo clara no fim: quanto gastaste,
   *  quanto recebeste bruto, e o resultado final depois de taxas. */
  netMzn?: number;
}) {
  const totalSpend = buySteps.reduce((s, x) => s + x.mznUsed, 0);
  const totalReceive = sellSteps.reduce((s, x) => s + x.mznUsed, 0);
  const isProfit = (netMzn ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-4">
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
                <StepRow key={s.advNo ?? i} step={s} index={i + 1} kind="spend" />
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
                <StepRow key={s.advNo ?? i} step={s} index={i + 1} kind="receive" />
              ))}
            </ul>
          )}
        </div>
      </div>

      {netMzn !== undefined ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-md border p-3",
            isProfit
              ? "border-[var(--good)]/30 bg-[var(--good-bg)]"
              : "border-[var(--critical)]/30 bg-[var(--critical-bg)]"
          )}
        >
          <span className="text-sm text-[var(--foreground)]">
            Gastas {formatMzn(totalSpend)} → recebes {formatMzn(totalReceive)} (bruto) → depois de taxas:
          </span>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Ficas no total com</div>
            <div className={cn("tabular text-lg font-bold", isProfit ? "text-[var(--good)]" : "text-[var(--critical)]")}>
              {formatMzn(totalSpend + netMzn)}
            </div>
            <div className={cn("tabular text-xs font-semibold", isProfit ? "text-[var(--good)]" : "text-[var(--critical)]")}>
              {isProfit ? "+" : ""}
              {formatMzn(netMzn)} {isProfit ? "de lucro" : "de prejuízo"}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
