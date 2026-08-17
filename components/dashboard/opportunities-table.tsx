"use client";

import { useMemo, useState } from "react";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { SortHeader } from "@/components/ui/sort-header";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/lib/use-pagination";
import { useSort } from "@/lib/use-sort";
import { formatUsdt, formatPct } from "@/lib/utils";
import type { OpportunitySummary } from "@/lib/queries";

const PAGE_SIZE = 20;
type SortKey = "detectedAt" | "netPct" | "netResultUsdt";

const EXCHANGE_LABEL: Record<string, string> = { binance: "Binance", bybit: "Bybit" };

export function OpportunitiesTable({ opportunities }: { opportunities: OpportunitySummary[] }) {
  const [query, setQuery] = useState("");
  const [onlyPassed, setOnlyPassed] = useState(false);

  const filtered = useMemo(() => {
    let list = opportunities;
    if (onlyPassed) list = list.filter((o) => o.passedFilters);
    if (!query.trim()) return list;
    const q = query.trim().toUpperCase();
    return list.filter((o) => `${o.pair} ${o.buyExchange} ${o.sellExchange}`.toUpperCase().includes(q));
  }, [opportunities, query, onlyPassed]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort<OpportunitySummary, SortKey>(
    filtered,
    (o, key) => {
      switch (key) {
        case "detectedAt": return new Date(o.detectedAt).getTime();
        case "netPct": return o.netPct === null ? null : Number(o.netPct);
        case "netResultUsdt": return o.netResultUsdt === null ? null : Number(o.netResultUsdt);
        default: return null;
      }
    },
    "detectedAt",
    "desc"
  );

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

  if (opportunities.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Ainda nenhuma oportunidade avaliada — o worker precisa de estar a correr.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <TableFilterInput
          value={query}
          onChange={(v) => { setQuery(v); goToPage(1); }}
          placeholder="Filtrar por par ou exchange (ex.: BTC, bybit)..."
        />
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={onlyPassed}
            onChange={(e) => { setOnlyPassed(e.target.checked); goToPage(1); }}
            className="h-4 w-4"
          />
          só as que passaram os filtros
        </label>
      </div>
      <ScrollTable maxHeight="32rem">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <SortHeader label="Quando" sortKey="detectedAt" active={sortKey === "detectedAt"} dir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2 font-medium">Par</th>
              <th className="px-3 py-2 font-medium">Comprar</th>
              <th className="px-3 py-2 font-medium">Vender</th>
              <SortHeader label="Resultado líquido" sortKey="netResultUsdt" active={sortKey === "netResultUsdt"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Margem" sortKey="netPct" active={sortKey === "netPct"} dir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nenhuma oportunidade corresponde ao filtro.
                </td>
              </tr>
            ) : (
              pageItems.map((o) => (
                <tr key={o.id} className="border-t border-[var(--border)] align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--muted)]">
                    {new Date(o.detectedAt).toLocaleTimeString("pt-PT")}
                  </td>
                  <td className="px-3 py-2 font-medium">{o.pair}</td>
                  <td className="tabular px-3 py-2">{EXCHANGE_LABEL[o.buyExchange]} {formatUsdt(o.buyPrice, 2)}</td>
                  <td className="tabular px-3 py-2">{EXCHANGE_LABEL[o.sellExchange]} {formatUsdt(o.sellPrice, 2)}</td>
                  <td className="tabular px-3 py-2">{formatUsdt(o.netResultUsdt)}</td>
                  <td className={`tabular px-3 py-2 font-semibold ${Number(o.netPct ?? 0) > 0 ? "text-[var(--good)]" : "text-[var(--critical)]"}`}>
                    {formatPct(o.netPct)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={o.passedFilters ? "good" : "neutral"}>{o.passedFilters ? "válida" : "rejeitada"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--muted)]">{o.rejectReasons.join("; ") || "—"}</td>
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
