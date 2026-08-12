"use client";

import { useMemo, useState } from "react";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { usePagination } from "@/lib/use-pagination";
import { formatMzn } from "@/lib/utils";
import type { TopMerchant } from "@/lib/p2p/analysis";

const PAGE_SIZE = 20;

export function TopMerchantsTable({ rows }: { rows: TopMerchant[] }) {
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
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Lado(s)</th>
              <th className="px-3 py-2 text-right">Ordens/mês</th>
              <th className="px-3 py-2 text-right">Conclusão</th>
              <th className="px-3 py-2 text-right">Faixa de preço</th>
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
                  <td className="px-3 py-2 text-[var(--muted)]">{m.merchantType}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {m.sides.includes("BUY") && m.sides.includes("SELL")
                      ? "compra + venda"
                      : m.sides.includes("SELL")
                        ? "só venda"
                        : "só compra"}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{m.monthOrders ?? "?"}</td>
                  <td className="tabular px-3 py-2 text-right">{((m.monthFinishRate ?? 0) * 100).toFixed(0)}%</td>
                  <td className="tabular px-3 py-2 text-right text-[var(--muted)]">
                    {formatMzn(m.priceMin)} – {formatMzn(m.priceMax)}
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
