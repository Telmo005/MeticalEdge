"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { usePagination } from "@/lib/use-pagination";
import { formatMzn } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { reputationTone, reputationLabel } from "@/lib/reputation";

export type AdRow = {
  advNo: string;
  price: number;
  merchantName: string;
  minMzn: number;
  maxExecutable: number;
  monthOrders: number | null;
  monthFinishRate: number | null;
  payMethods: string[];
};

type SortKey = "price" | "merchantName" | "minMzn" | "maxExecutable" | "monthOrders" | "monthFinishRate";

const PAGE_SIZE = 20;

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "price", label: "Preço", align: "right" },
  { key: "merchantName", label: "Comerciante" },
  { key: "minMzn", label: "Mín.", align: "right" },
  { key: "maxExecutable", label: "Máx. executável", align: "right" },
  { key: "monthOrders", label: "Ordens/mês", align: "right" },
  { key: "monthFinishRate", label: "Conclusão", align: "right" },
];

export function SortableAdsTable({
  ads,
  priceLabel,
  defaultSortDir = "asc",
}: {
  ads: AdRow[];
  priceLabel: string;
  defaultSortDir?: "asc" | "desc";
}) {
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return ads;
    const q = query.trim().toLowerCase();
    return ads.filter((ad) => ad.merchantName.toLowerCase().includes(q));
  }, [ads, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "string" ? av.localeCompare(bv as string) : (av ?? -Infinity) - ((bv as number) ?? -Infinity);
      return sortDir === "asc" ? an : -an;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? defaultSortDir : "desc");
    }
    goToPage(1);
  }

  return (
    <div className="flex flex-col gap-3">
      <TableFilterInput value={query} onChange={(v) => { setQuery(v); goToPage(1); }} />
      <ScrollTable>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className={cn("px-3 py-2", col.align === "right" && "text-right")}>
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-[var(--foreground)]",
                      col.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {col.key === "price" ? priceLabel : col.label}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2">Métodos de pagamento</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nenhum comerciante corresponde a &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              pageItems.map((ad, i) => {
                const tone = reputationTone(ad.monthFinishRate, ad.monthOrders);
                return (
                  <tr key={`${ad.advNo}-${i}`} className="border-t border-[var(--border)]">
                    <td className="tabular px-3 py-2 text-right font-medium">{formatMzn(ad.price)}</td>
                    <td className="px-3 py-2">{ad.merchantName}</td>
                    <td className="tabular px-3 py-2 text-right text-[var(--muted)]">{formatMzn(ad.minMzn)}</td>
                    <td className="tabular px-3 py-2 text-right text-[var(--muted)]">{formatMzn(ad.maxExecutable)}</td>
                    <td className="tabular px-3 py-2 text-right text-[var(--muted)]">{ad.monthOrders ?? "?"}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone={tone}>
                        {reputationLabel(ad.monthFinishRate, ad.monthOrders)} ·{" "}
                        {((ad.monthFinishRate ?? 0) * 100).toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">{ad.payMethods.join(", ")}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={PAGE_SIZE} onPageChange={goToPage} />
      </ScrollTable>
    </div>
  );
}
