import { CardLabel } from "@/components/ui/card";
import { cn, formatMzn, formatUsdApprox } from "@/lib/utils";
import type { CostBreakdown } from "@/lib/p2p/fees";

/**
 * De onde vem a diferença entre o lucro bruto e o que fica para ti.
 *
 * Responde a uma dúvida legítima que a app nunca respondia: "porque é que o
 * bruto era 60 MZN e o líquido é 22?". Passou a interessar ainda mais agora
 * que o custo de mover Meticais (M-Pesa/e-Mola) entra na conta — antes era
 * simplesmente ignorado, e o lucro mostrado era sistematicamente optimista.
 */
export function CostBreakdown({
  grossProfitMzn,
  netMzn,
  costs,
  referenceUsdMzn = null,
}: {
  grossProfitMzn: number;
  netMzn: number;
  costs: CostBreakdown;
  /** Taxa de referência USD/MZN — mostra "≈ X USD" ao lado do líquido para
   *  quem pensa em dólares. Puramente informativo. */
  referenceUsdMzn?: number | null;
}) {
  const usdApprox = formatUsdApprox(netMzn, referenceUsdMzn);
  const lines = [
    { label: "Taxas da Binance (por ordem)", value: costs.takerFeeMzn },
    { label: "Taxa de anúncio próprio", value: costs.makerFeeMzn },
    { label: "Transferências de dinheiro", value: costs.railSendFeeMzn },
    { label: "Levantamento", value: costs.railWithdrawFeeMzn },
  ].filter((l) => l.value > 0.004);

  if (lines.length === 0) return null;

  return (
    <div>
      <CardLabel>De onde vem a diferença</CardLabel>
      <ul className="mt-1 flex flex-col gap-1.5 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="text-[var(--muted)]">Lucro antes de custos</span>
          <span className="tabular font-semibold">{formatMzn(grossProfitMzn)}</span>
        </li>
        {lines.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-3">
            <span className="text-[var(--muted)]">{l.label}</span>
            <span className="tabular text-[var(--critical)]">− {formatMzn(l.value)}</span>
          </li>
        ))}
        <li className="mt-1 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
          <span className="font-semibold">Fica para ti</span>
          <span className="text-right">
            <span
              className={cn(
                "tabular font-bold",
                netMzn >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
              )}
            >
              {netMzn >= 0 ? "+" : ""}
              {formatMzn(netMzn)}
            </span>
            {usdApprox ? <span className="block text-xs text-[var(--muted)]">{usdApprox}</span> : null}
          </span>
        </li>
      </ul>
    </div>
  );
}
