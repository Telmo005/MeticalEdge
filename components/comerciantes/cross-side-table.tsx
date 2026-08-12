"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { usePagination } from "@/lib/use-pagination";
import { formatMzn, formatPct } from "@/lib/utils";
import type { MerchantCrossSide } from "@/lib/p2p/analysis";

const PAGE_SIZE = 20;

export function CrossSideTable({ rows }: { rows: MerchantCrossSide[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((m) => m.merchantName.toLowerCase().includes(q));
  }, [rows, query]);

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <TableFilterInput value={query} onChange={(v) => { setQuery(v); goToPage(1); }} />
      <ScrollTable>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="px-3 py-2">Comerciante</th>
              <th className="px-3 py-2 text-right">Compra (paga)</th>
              <th className="px-3 py-2 text-right">Venda (cobra)</th>
              <th className="px-3 py-2 text-right">Margem própria</th>
              <th className="px-3 py-2 text-right">Ordens/mês</th>
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
