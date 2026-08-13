"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { SortHeader } from "@/components/ui/sort-header";
import { usePagination } from "@/lib/use-pagination";
import { useSort } from "@/lib/use-sort";
import { formatMzn } from "@/lib/utils";
import type { Trade } from "@/db/schema";

const PAGE_SIZE = 20;
type SortKey = "executedAt" | "capitalUsedMzn" | "buyPrice" | "sellPrice" | "netProfitMzn" | "outcome";

const OUTCOME_TONE: Record<string, "good" | "warning" | "critical"> = {
  success: "good",
  partial: "warning",
  loss: "critical",
};

const OUTCOME_LABEL: Record<string, string> = {
  success: "Sucesso",
  partial: "Parcial",
  loss: "Prejuízo",
};

export function TradesTable({ trades }: { trades: Trade[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return trades;
    const q = query.trim().toLowerCase();
    return trades.filter(
      (t) => t.outcome.toLowerCase().includes(q) || (t.notes ?? "").toLowerCase().includes(q)
    );
  }, [trades, query]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort<Trade, SortKey>(
    filtered,
    (t, key) => {
      switch (key) {
        case "executedAt": return new Date(t.executedAt).getTime();
        case "capitalUsedMzn": return Number(t.capitalUsedMzn);
        case "buyPrice": return t.buyPrice === null ? null : Number(t.buyPrice);
        case "sellPrice": return t.sellPrice === null ? null : Number(t.sellPrice);
        case "netProfitMzn": return Number(t.netProfitMzn);
        case "outcome": return t.outcome;
        default: return null;
      }
    },
    "executedAt",
    "desc"
  );

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <TableFilterInput
        value={query}
        onChange={(v) => { setQuery(v); goToPage(1); }}
        placeholder="Filtrar por resultado ou nota..."
      />
      <ScrollTable>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <SortHeader label="Data" sortKey="executedAt" active={sortKey === "executedAt"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Capital usado" align="right" sortKey="capitalUsedMzn" active={sortKey === "capitalUsedMzn"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Compra" align="right" sortKey="buyPrice" active={sortKey === "buyPrice"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Venda" align="right" sortKey="sellPrice" active={sortKey === "sellPrice"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Lucro líquido" align="right" sortKey="netProfitMzn" active={sortKey === "netProfitMzn"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Resultado" sortKey="outcome" active={sortKey === "outcome"} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nenhuma operação corresponde a &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              pageItems.map((t) => (
                <tr key={t.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {new Date(t.executedAt).toLocaleString("pt-PT")}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(t.capitalUsedMzn)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(t.buyPrice)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(t.sellPrice)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(t.netProfitMzn)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={OUTCOME_TONE[t.outcome] ?? "warning"}>{OUTCOME_LABEL[t.outcome] ?? t.outcome}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={PAGE_SIZE} onPageChange={goToPage} />
      </ScrollTable>
    </div>
  );
}
