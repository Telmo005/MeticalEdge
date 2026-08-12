"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel } from "@/components/ui/card";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { ExecutionPlan } from "@/components/execution-plan";
import { formatMzn, formatPct, formatUsdt, cn } from "@/lib/utils";
import { usePagination } from "@/lib/use-pagination";
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

const PAGE_SIZE = 15;

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
  const [query, setQuery] = useState("");

  const usableRows = rows.filter((r) => r.usable);
  const best = usableRows[0]; // já vem ordenado: usáveis primeiro, melhor lucro primeiro

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => r.merchantName.toLowerCase().includes(q));
  }, [rows, query]);

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardLabel>Melhor opção real</CardLabel>
          {best ? (
            <>
              <div className="tabular text-lg font-semibold">{formatMzn(best.netMzn)}</div>
              <p className="text-xs text-[var(--muted)]">vendendo a {best.merchantName}</p>
            </>
          ) : (
            <div className="text-sm text-[var(--muted)]">nenhuma opção executável agora</div>
          )}
        </Card>
        <Card>
          <CardLabel>Opções executáveis</CardLabel>
          <div className="tabular text-lg font-semibold">
            {usableRows.length} <span className="text-sm font-normal text-[var(--muted)]">de {rows.length}</span>
          </div>
        </Card>
        <Card>
          <CardLabel>O que significa &ldquo;não usável&rdquo;</CardLabel>
          <p className="text-xs text-[var(--muted)]">
            O anúncio desse comerciante é pequeno ou exige mínimo maior do que o USDT que compraste — não dá
            para vender-lhe nada, não é uma questão de preço.
          </p>
        </Card>
      </div>

      <TableFilterInput value={query} onChange={(v) => { setQuery(v); goToPage(1); }} />

      <ScrollTable maxHeight="none" className="max-h-none">
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
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nenhum comerciante corresponde a &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : null}
            {pageItems.map((r) => {
              const isOpen = expanded === r.advNo;
              const tone = reputationTone(r.monthFinishRate, r.monthOrders);
              return (
                <Fragment key={r.advNo}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.advNo)}
                    className={cn(
                      "cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-2)]",
                      isOpen && "bg-[var(--surface-2)]",
                      !r.usable && "opacity-50"
                    )}
                  >
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                    <td className="px-3 py-2">
                      {r.merchantName}
                      {!r.usable ? (
                        <span className="ml-2 text-xs text-[var(--critical)]">(não usável)</span>
                      ) : null}
                    </td>
                    <td className="tabular px-3 py-2 text-right">{formatMzn(r.price)}</td>
                    {r.usable ? (
                      <>
                        <td className="tabular px-3 py-2 text-right">{formatUsdt(r.usdtSold)}</td>
                        <td className="tabular px-3 py-2 text-right font-semibold">{formatMzn(r.netMzn)}</td>
                        <td className="tabular px-3 py-2 text-right">{formatPct(r.netPct)}</td>
                      </>
                    ) : (
                      <td colSpan={3} className="px-3 py-2 text-center text-[var(--muted)]">
                        sem capacidade suficiente para vender aqui
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Badge tone={tone}>
                        {r.monthOrders ?? "?"}/mês · {((r.monthFinishRate ?? 0) * 100).toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                      <td colSpan={7} className="px-3 py-3">
                        <ExecutionPlan buySteps={buySteps} sellSteps={r.usable ? [r.sellStep] : []} />
                        {r.usable && r.residualUsdt > 0.0001 ? (
                          <p className="mt-2 text-xs text-[var(--warning)]">
                            Sobram {formatUsdt(r.residualUsdt)} não vendidos a este comerciante — o valor
                            acima já conta esse resíduo marcado ao preço de compra.
                          </p>
                        ) : null}
                        {!r.usable ? (
                          <p className="text-sm text-[var(--muted)]">
                            Este comerciante não tem capacidade/limite mínimo compatível com o USDT
                            disponível — não há nada para vender-lhe nesta simulação.
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
        <Pagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={PAGE_SIZE} onPageChange={goToPage} />
      </ScrollTable>
    </div>
  );
}
