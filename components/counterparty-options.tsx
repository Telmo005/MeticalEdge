"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { ExecutionPlan } from "@/components/execution-plan";
import { formatMzn, formatPct, formatUsdt, cn } from "@/lib/utils";
import type { FillStep } from "@/lib/p2p/orderbook";

export type CounterpartyRow = {
  merchantName: string;
  advNo: string;
  price: number;
  usdtSold: number;
  mznReceived: number;
  residualUsdt: number;
  netMzn: number;
  netPct: number;
  usable: boolean;
  monthOrders: number | null;
  monthFinishRate: number | null;
  sellStep: FillStep;
};

function reputationTone(finishRate: number | null, orders: number | null): "good" | "warning" | "critical" {
  if (finishRate === null || orders === null) return "warning";
  if (finishRate >= 0.97 && orders >= 200) return "good";
  if (finishRate >= 0.95 && orders >= 50) return "warning";
  return "critical";
}

/** Lista TODAS as opções de venda, sem filtrar por reputação — o objectivo
 *  é deixar o utilizador ver e decidir, não escondermos nada por baixo dos
 *  panos. Cada linha expande para mostrar o plano de execução completo. */
export function CounterpartyOptions({ buySteps, rows }: { buySteps: FillStep[]; rows: CounterpartyRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ScrollTable>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
          <tr>
            <th className="w-8 px-3 py-2" />
            <th className="px-3 py-2">Comerciante</th>
            <th className="px-3 py-2 text-right">Preço</th>
            <th className="px-3 py-2 text-right">USDT vendido</th>
            <th className="px-3 py-2 text-right">Lucro líquido</th>
            <th className="px-3 py-2 text-right">ROI</th>
            <th className="px-3 py-2">Reputação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = expanded === r.advNo;
            const tone = reputationTone(r.monthFinishRate, r.monthOrders);
            return (
              <Fragment key={r.advNo}>
                <tr
                  onClick={() => setExpanded(isOpen ? null : r.advNo)}
                  className={cn(
                    "cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-2)]",
                    isOpen && "bg-[var(--surface-2)]"
                  )}
                >
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </td>
                  <td className="px-3 py-2">
                    {r.merchantName}
                    {!r.usable ? <span className="ml-2 text-xs text-[var(--critical)]">(não usável)</span> : null}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(r.price)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatUsdt(r.usdtSold)}</td>
                  <td className="tabular px-3 py-2 text-right font-semibold">{formatMzn(r.netMzn)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatPct(r.netPct)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={tone}>
                      {r.monthOrders ?? "?"}/mês · {((r.monthFinishRate ?? 0) * 100).toFixed(0)}%
                    </Badge>
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                    <td colSpan={7} className="px-3 py-3">
                      <ExecutionPlan buySteps={buySteps} sellSteps={[r.sellStep]} />
                      {r.residualUsdt > 0.0001 ? (
                        <p className="mt-2 text-xs text-[var(--warning)]">
                          Sobram {formatUsdt(r.residualUsdt)} não vendidos a este comerciante — o valor acima já
                          conta esse resíduo marcado ao preço de compra.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </ScrollTable>
  );
}
