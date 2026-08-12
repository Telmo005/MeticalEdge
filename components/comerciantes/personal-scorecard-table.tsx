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
import type { MerchantScoreRow } from "@/lib/p2p/merchant-scorecard";

const PAGE_SIZE = 20;
type SortKey = "merchantName" | "tradesInvolved" | "avgNetProfitMzn" | "successRate";

export function PersonalScorecardTable({ rows }: { rows: MerchantScoreRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => r.merchantName.toLowerCase().includes(q));
  }, [rows, query]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort<MerchantScoreRow, SortKey>(
    filtered,
    (r, key) => {
      switch (key) {
        case "merchantName": return r.merchantName;
        case "tradesInvolved": return r.tradesInvolved;
        case "avgNetProfitMzn": return r.avgNetProfitMzn;
        case "successRate": return r.successRate;
        default: return null;
      }
    },
    "tradesInvolved",
    "desc"
  );

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Ainda não há operações reportadas ligadas a uma oportunidade — regista operações em /trades para
        começares a construir a tua própria nota de confiança por comerciante.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TableFilterInput value={query} onChange={(v) => { setQuery(v); goToPage(1); }} />
      <ScrollTable>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <SortHeader label="Comerciante" sortKey="merchantName" active={sortKey === "merchantName"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Operações contigo" align="right" sortKey="tradesInvolved" active={sortKey === "tradesInvolved"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Lucro líquido médio" align="right" sortKey="avgNetProfitMzn" active={sortKey === "avgNetProfitMzn"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Taxa de sucesso" align="right" sortKey="successRate" active={sortKey === "successRate"} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nenhum comerciante corresponde a &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              pageItems.map((r) => (
                <tr key={r.merchantId} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{r.merchantName}</td>
                  <td className="tabular px-3 py-2 text-right">{r.tradesInvolved}</td>
                  <td className="tabular px-3 py-2 text-right font-semibold">{formatMzn(r.avgNetProfitMzn)}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge tone={r.successRate >= 0.8 ? "good" : r.successRate >= 0.5 ? "warning" : "critical"}>
                      {(r.successRate * 100).toFixed(0)}%
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
