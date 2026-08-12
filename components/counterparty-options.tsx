"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel } from "@/components/ui/card";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { SortHeader } from "@/components/ui/sort-header";
import { ExecutionPlan } from "@/components/execution-plan";
import { formatMzn, formatPct, formatUsdt, cn } from "@/lib/utils";
import { usePagination } from "@/lib/use-pagination";
import { useSort } from "@/lib/use-sort";
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
type SortKey = "merchantName" | "price" | "usdtSold" | "netMzn" | "netPct" | "reputation";

function reputationTone(finishRate: number | null, orders: number | null): "good" | "warning" | "critical" {
  if (finishRate === null || orders === null) return "warning";
  if (finishRate >= 0.97 && orders >= 200) return "good";
  if (finishRate >= 0.95 && orders >= 50) return "warning";
  return "critical";
}

/** Por omissão só mostra opções realmente boas (usáveis e acima do limiar de
 *  lucro definido em Configurações) — ninguém deve ter de calcular nada para
 *  perceber se vale a pena. O resto fica atrás de "ver todas". */
export function CounterpartyOptions({
  buySteps, rows, minDisplayProfitMzn = 0,
}: { buySteps: FillStep[]; rows: CounterpartyRow[]; minDisplayProfitMzn?: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const usableRows = useMemo(() => rows.filter((r) => r.usable), [rows]);
  const best = usableRows[0]; // já vem ordenado: usáveis primeiro, melhor lucro primeiro
  const goodRows = useMemo(
    () => usableRows.filter((r) => r.netMzn >= minDisplayProfitMzn),
    [usableRows, minDisplayProfitMzn]
  );

  const filtered = useMemo(() => {
    const baseRows = showAll ? rows : goodRows;
    if (!query.trim()) return baseRows;
    const q = query.trim().toLowerCase();
    return baseRows.filter((r) => r.merchantName.toLowerCase().includes(q));
  }, [rows, goodRows, showAll, query]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort<CounterpartyRow, SortKey>(
    filtered,
    (r, key) => {
      switch (key) {
        case "merchantName": return r.merchantName;
        case "price": return r.price;
        case "usdtSold": return r.usable ? r.usdtSold : null;
        case "netMzn": return r.usable ? r.netMzn : null;
        case "netPct": return r.usable ? r.netPct : null;
        case "reputation": return r.monthFinishRate ?? -1;
        default: return null;
      }
    },
    "netMzn",
    "desc"
  );

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

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
          <CardLabel>Boas opções agora</CardLabel>
          <div className="tabular text-lg font-semibold">
            {goodRows.length} <span className="text-sm font-normal text-[var(--muted)]">de {rows.length}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {minDisplayProfitMzn > 0
              ? `lucro de pelo menos ${formatMzn(minDisplayProfitMzn)}`
              : "com lucro e executáveis"}
          </p>
        </Card>
        <Card>
          <CardLabel>O que significa &ldquo;não usável&rdquo;</CardLabel>
          <p className="text-xs text-[var(--muted)]">
            O anúncio desse comerciante é pequeno ou exige mínimo maior do que o USDT que compraste — não dá
            para vender-lhe nada, não é uma questão de preço.
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TableFilterInput value={query} onChange={(v) => { setQuery(v); goToPage(1); }} />
        <button
          type="button"
          onClick={() => { setShowAll((v) => !v); goToPage(1); }}
          className="whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]"
        >
          {showAll ? `A mostrar todas (${rows.length}) — ver só as boas` : `Ver todas as ${rows.length} opções`}
        </button>
      </div>

      {goodRows.length === 0 && !showAll ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhuma opção passa o lucro mínimo definido agora mesmo. Toca em &ldquo;Ver todas as {rows.length}{" "}
            opções&rdquo; para ver tudo, incluindo as que não valem a pena neste momento.
          </p>
        </Card>
      ) : (
        <ScrollTable maxHeight="none" className="max-h-none">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="w-8 px-3 py-2" />
                <SortHeader label="Comerciante" sortKey="merchantName" active={sortKey === "merchantName"} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Preço" align="right" sortKey="price" active={sortKey === "price"} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="USDT vendido" align="right" sortKey="usdtSold" active={sortKey === "usdtSold"} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Lucro líquido" align="right" sortKey="netMzn" active={sortKey === "netMzn"} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="ROI" align="right" sortKey="netPct" active={sortKey === "netPct"} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Reputação" sortKey="reputation" active={sortKey === "reputation"} dir={sortDir} onClick={toggleSort} />
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
                          <ExecutionPlan
                            buySteps={buySteps}
                            sellSteps={r.usable ? [r.sellStep] : []}
                            netMzn={r.usable ? r.netMzn : undefined}
                          />
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
      )}
    </div>
  );
}
