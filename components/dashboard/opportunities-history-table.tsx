"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { usePagination } from "@/lib/use-pagination";
import { formatMzn, formatPct } from "@/lib/utils";
import type { Opportunity } from "@/db/schema";

const PAGE_SIZE = 10;

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

export function OpportunitiesHistoryTable({ opportunities }: { opportunities: Opportunity[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return opportunities;
    const q = query.trim().toLowerCase();
    return opportunities.filter((o) => o.status.toLowerCase().includes(q));
  }, [opportunities, query]);

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <TableFilterInput
        value={query}
        onChange={(v) => { setQuery(v); goToPage(1); }}
        placeholder="Filtrar por estado (detected, alerted, traded...)"
      />
      <ScrollTable>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2 text-right">Compra</th>
              <th className="px-3 py-2 text-right">Venda</th>
              <th className="px-3 py-2 text-right">Líquido médio</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nenhuma avaliação corresponde a &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              pageItems.map((o) => (
                <tr key={o.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-[var(--muted)]">{timeAgo(new Date(o.detectedAt))}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(o.buyVwap)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(o.sellVwap)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatPct(o.netPctMedium)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={o.status === "alerted" || o.status === "traded" ? "good" : "neutral"}>
                      {o.status}
                    </Badge>
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
