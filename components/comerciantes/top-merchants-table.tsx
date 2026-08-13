"use client";

import { useMemo, useState } from "react";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { SortHeader } from "@/components/ui/sort-header";
import { usePagination } from "@/lib/use-pagination";
import { useSort } from "@/lib/use-sort";
import { formatMzn } from "@/lib/utils";
import type { TopMerchant } from "@/lib/p2p/analysis";

const PAGE_SIZE = 20;
type SortKey = "merchantName" | "merchantType" | "monthOrders" | "monthFinishRate" | "priceMin";

function merchantTypeLabel(type: string): string {
  if (type.toLowerCase() === "merchant") return "Comerciante verificado";
  if (type.toLowerCase() === "user") return "Utilizador comum";
  return type;
}

export function TopMerchantsTable({ rows }: { rows: TopMerchant[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((m) => m.merchantName.toLowerCase().includes(q));
  }, [rows, query]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort<TopMerchant, SortKey>(
    filtered,
    (m, key) => {
      switch (key) {
        case "merchantName": return m.merchantName;
        case "merchantType": return m.merchantType;
        case "monthOrders": return m.monthOrders ?? -1;
        case "monthFinishRate": return m.monthFinishRate ?? -1;
        case "priceMin": return m.priceMin;
        default: return null;
      }
    },
    "monthOrders",
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
              <SortHeader label="Tipo" sortKey="merchantType" active={sortKey === "merchantType"} dir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2">Lado(s)</th>
              <SortHeader label="Ordens/mês" align="right" sortKey="monthOrders" active={sortKey === "monthOrders"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Conclusão" align="right" sortKey="monthFinishRate" active={sortKey === "monthFinishRate"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Faixa de preço" align="right" sortKey="priceMin" active={sortKey === "priceMin"} dir={sortDir} onClick={toggleSort} />
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
                  <td className="px-3 py-2 text-[var(--muted)]">{merchantTypeLabel(m.merchantType)}</td>
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
