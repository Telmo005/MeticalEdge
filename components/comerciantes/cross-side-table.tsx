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
import type { MerchantCrossSide } from "@/lib/p2p/analysis";

const PAGE_SIZE = 20;
type SortKey = "merchantName" | "bestBid" | "bestAsk" | "spreadOwnPct" | "monthOrders";

export function CrossSideTable({ rows }: { rows: MerchantCrossSide[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((m) => m.merchantName.toLowerCase().includes(q));
  }, [rows, query]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort<MerchantCrossSide, SortKey>(
    filtered,
    (m, key) => {
      switch (key) {
        case "merchantName": return m.merchantName;
        case "bestBid": return m.bestBid;
        case "bestAsk": return m.bestAsk;
        case "spreadOwnPct": return -m.spreadOwnPct;
        case "monthOrders": return m.monthOrders ?? -1;
        default: return null;
      }
    },
    "spreadOwnPct",
    "desc"
  );

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <TableFilterInput value={query} onChange={(v) => { setQuery(v); goToPage(1); }} />
      <ScrollTable>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <SortHeader label="Comerciante" sortKey="merchantName" active={sortKey === "merchantName"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Compra (paga)" align="right" sortKey="bestBid" active={sortKey === "bestBid"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Venda (cobra)" align="right" sortKey="bestAsk" active={sortKey === "bestAsk"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Margem própria" align="right" sortKey="spreadOwnPct" active={sortKey === "spreadOwnPct"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Ordens/mês" align="right" sortKey="monthOrders" active={sortKey === "monthOrders"} dir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2">Métodos</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nenhum comerciante corresponde a &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              pageItems.map((m) => (
                <tr key={m.merchantId} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{m.merchantName}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(m.bestBid)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(m.bestAsk)}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge tone={m.spreadOwnPct < 0 ? "good" : "warning"}>{formatPct(-m.spreadOwnPct)}</Badge>
                  </td>
                  <td className="tabular px-3 py-2 text-right text-[var(--muted)]">{m.monthOrders ?? "?"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{m.payMethods.join(", ")}</td>
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
