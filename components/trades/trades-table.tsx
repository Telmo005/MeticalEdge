"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { usePagination } from "@/lib/use-pagination";
import { formatMzn } from "@/lib/utils";
import type { Trade } from "@/db/schema";

const PAGE_SIZE = 20;

const OUTCOME_TONE: Record<string, "good" | "warning" | "critical"> = {
  success: "good",
  partial: "warning",
  loss: "critical",
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

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(filtered, PAGE_SIZE);

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
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2 text-right">Capital usado</th>
              <th className="px-3 py-2 text-right">Compra</th>
              <th className="px-3 py-2 text-right">Venda</th>
              <th className="px-3 py-2 text-right">Lucro líquido</th>
              <th className="px-3 py-2">Resultado</th>
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
                    <Badge tone={OUTCOME_TONE[t.outcome] ?? "warning"}>{t.outcome}</Badge>
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
