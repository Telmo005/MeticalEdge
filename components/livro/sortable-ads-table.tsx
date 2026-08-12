"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { formatMzn } from "@/lib/utils";
import { cn } from "@/lib/utils";

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

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "price", label: "Preço", align: "right" },
  { key: "merchantName", label: "Comerciante" },
  { key: "minMzn", label: "Mín.", align: "right" },
  { key: "maxExecutable", label: "Máx. executável", align: "right" },
  { key: "monthOrders", label: "Ordens/mês", align: "right" },
  { key: "monthFinishRate", label: "Conclusão", align: "right" },
];

function reputationTone(finishRate: number | null, orders: number | null): "good" | "warning" | "critical" {
  if (finishRate === null || orders === null) return "warning";
  if (finishRate >= 0.97 && orders >= 200) return "good";
  if (finishRate >= 0.95 && orders >= 50) return "warning";
  return "critical";
}

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

  const sorted = useMemo(() => {
    const copy = [...ads];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "string" ? av.localeCompare(bv as string) : (av ?? -Infinity) - ((bv as number) ?? -Infinity);
      return sortDir === "asc" ? an : -an;
    });
    return copy;
  }, [ads, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? defaultSortDir : "desc");
    }
  }

  return (
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
          {sorted.map((ad, i) => {
            const tone = reputationTone(ad.monthFinishRate, ad.monthOrders);
            return (
              <tr key={`${ad.advNo}-${i}`} className="border-t border-[var(--border)]">
                <td className="tabular px-3 py-2 text-right font-medium">{formatMzn(ad.price)}</td>
                <td className="px-3 py-2">{ad.merchantName}</td>
                <td className="tabular px-3 py-2 text-right text-[var(--muted)]">{formatMzn(ad.minMzn)}</td>
                <td className="tabular px-3 py-2 text-right text-[var(--muted)]">{formatMzn(ad.maxExecutable)}</td>
                <td className="tabular px-3 py-2 text-right text-[var(--muted)]">{ad.monthOrders ?? "?"}</td>
                <td className="px-3 py-2 text-right">
                  <Badge tone={tone}>{((ad.monthFinishRate ?? 0) * 100).toFixed(0)}%</Badge>
                </td>
                <td className="px-3 py-2 text-[var(--muted)]">{ad.payMethods.join(", ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollTable>
  );
}
