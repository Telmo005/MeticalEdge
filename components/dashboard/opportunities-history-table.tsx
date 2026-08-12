"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { SortHeader } from "@/components/ui/sort-header";
import { usePagination } from "@/lib/use-pagination";
import { useSort } from "@/lib/use-sort";
import { formatMzn, formatPct } from "@/lib/utils";
import type { Opportunity } from "@/db/schema";

const PAGE_SIZE = 10;
type SortKey = "detectedAt" | "buyVwap" | "sellVwap" | "netPctMedium" | "status";

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

  const { sorted, sortKey, sortDir, toggleSort } = useSort<Opportunity, SortKey>(
    filtered,
    (o, key) => {
      switch (key) {
        case "detectedAt": return new Date(o.detectedAt).getTime();
        case "buyVwap": return o.buyVwap === null ? null : Number(o.buyVwap);
        case "sellVwap": return o.sellVwap === null ? null : Number(o.sellVwap);
        case "netPctMedium": return o.netPctMedium === null ? null : Number(o.netPctMedium);
        case "status": return o.status;
        default: return null;
      }
    },
    "detectedAt",
    "desc"
  );

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

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
              <SortHeader label="Quando" sortKey="detectedAt" active={sortKey === "detectedAt"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Compra" align="right" sortKey="buyVwap" active={sortKey === "buyVwap"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Venda" align="right" sortKey="sellVwap" active={sortKey === "sellVwap"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Líquido médio" align="right" sortKey="netPctMedium" active={sortKey === "netPctMedium"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Estado" sortKey="status" active={sortKey === "status"} dir={sortDir} onClick={toggleSort} />
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
