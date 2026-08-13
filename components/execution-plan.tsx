import { ArrowDown, ArrowRight, ShoppingCart, Banknote, Scale } from "lucide-react";
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
  /** Limite do anúncio (não desta operação) — quanto este comerciante
   *  aceita no mínimo e no máximo, de uma vez. `undefined` só acontece em
   *  registos antigos gravados antes deste campo existir. */
  minMzn?: number;
  maxMzn?: number;
};

const KIND_STYLE = {
  spend: { border: "border-l-[var(--accent)]", chip: "bg-[var(--accent)]" },
  receive: { border: "border-l-[var(--accent-2)]", chip: "bg-[var(--accent-2)]" },
} as const;

function StepRow({ step, index, kind }: { step: PlanStep; index: number; kind: "spend" | "receive" }) {
  const tone = reputationTone(step.monthFinishRate, step.monthOrders);
  const style = KIND_STYLE[kind];
  return (
    <li className={cn("flex items-start gap-3 rounded-md border-l-4 bg-[var(--surface-2)] p-3", style.border)}>
      <span className={cn("tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", style.chip)}>
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {step.merchantName}
          <span className="ml-2 text-[var(--muted)] font-normal">
            {formatUsdt(step.usdtAmount)} a {formatMzn(step.price)}/USDT
          </span>
        </p>
        <div className="mt-1.5 flex flex-col gap-1">
          <Badge tone={tone} className="w-fit">
            {reputationLabel(step.monthFinishRate, step.monthOrders)} · {step.monthOrders ?? "?"} ordens/mês ·{" "}
            {((step.monthFinishRate ?? 0) * 100).toFixed(0)}% conclusão
          </Badge>
          {step.minMzn !== undefined && step.maxMzn !== undefined ? (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
              <Scale className="h-3 w-3 shrink-0" />
              limite do anúncio: {formatMzn(step.minMzn)} – {formatMzn(step.maxMzn)}
            </span>
          ) : null}
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

function StepColumn({
  title, icon: Icon, steps, kind, startIndex,
}: {
  title: string; icon: React.ElementType; steps: PlanStep[]; kind: "spend" | "receive"; startIndex: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        <Icon className={cn("h-3.5 w-3.5", kind === "spend" ? "text-[var(--accent)]" : "text-[var(--accent-2)]")} />
        {title}
      </p>
      {steps.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Sem execução possível.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <StepRow key={s.advNo ?? i} step={s} index={startIndex + i} kind={kind} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Ponte visual entre as duas colunas — horizontal quando empilhadas (telemóvel),
 *  vertical quando lado a lado (ecrã largo). Existe para que "comprei em N
 *  sítios, vendo em M sítios diferentes" nunca pareça um emparelhamento
 *  linha-a-linha: o USDT junta-se todo numa bolsa antes de ser revendido. */
function FlowBridge({ totalUsdt }: { totalUsdt: number }) {
  return (
    <div className="flex items-center gap-3 sm:flex-col sm:justify-center sm:gap-2 sm:self-stretch sm:px-1">
      <div className="h-px flex-1 bg-[var(--border)] sm:h-full sm:w-px sm:flex-1" />
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-center text-[11px] font-medium text-[var(--muted)] shadow-sm sm:max-w-[8rem] sm:flex-col sm:whitespace-normal sm:text-center">
        <ArrowDown className="h-3.5 w-3.5 shrink-0 sm:hidden" />
        <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
        <span>
          Tens <span className="tabular font-semibold text-[var(--foreground)]">{formatUsdt(totalUsdt)}</span> — vende
          tudo, não interessa a quem compraste
        </span>
      </div>
      <div className="h-px flex-1 bg-[var(--border)] sm:h-full sm:w-px sm:flex-1" />
    </div>
  );
}

/** Instruções passo-a-passo em linguagem simples: de quem comprar, a quem
 *  vender, e quanto — para quem não conhece o mercado P2P conseguir
 *  executar sem interpretar números soltos. Cada valor diz claramente se é
 *  dinheiro que sai ("gastas") ou que entra ainda sem descontar taxas
 *  ("recebes bruto") — sem isto, o valor de venda parece o ganho final,
 *  quando só o resumo no fim (net) é que é.
 *
 *  Compra e venda ficam lado a lado em ecrãs largos (empilhadas no
 *  telemóvel), com a numeração em sequência única (o passo 2 continua a
 *  contagem do passo 1 em vez de recomeçar) e uma "ponte" visual a meio —
 *  de propósito, para nunca parecer que a linha 1 da compra corresponde à
 *  linha 1 da venda: o USDT comprado junta-se todo numa bolsa antes de ser
 *  revendido em pedaços completamente diferentes (outras contrapartes,
 *  outros limites, outro número de ordens). */
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
  const totalUsdtBought = buySteps.reduce((s, x) => s + x.usdtAmount, 0);
  const isProfit = (netMzn ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <StepColumn title="Passo 1 — Compra USDT (nesta ordem)" icon={ShoppingCart} steps={buySteps} kind="spend" startIndex={1} />
        </div>

        {buySteps.length > 0 && sellSteps.length > 0 ? <FlowBridge totalUsdt={totalUsdtBought} /> : null}

        <div className="min-w-0 flex-1">
          <StepColumn
            title="Passo 2 — Vende o USDT comprado (nesta ordem)"
            icon={Banknote}
            steps={sellSteps}
            kind="receive"
            startIndex={buySteps.length + 1}
          />
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
