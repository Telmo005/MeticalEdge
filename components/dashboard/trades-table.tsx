"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/lib/use-pagination";
import { useSort } from "@/lib/use-sort";
import { formatUsdt } from "@/lib/utils";
import type { Trade } from "@/db/schema";

const PAGE_SIZE = 20;
type SortKey = "startedAt" | "profitRealUsdt";
type TradeEventRow = { at: Date; event: string; detail: string | null };

const OUTCOME_TONE = { in_progress: "warning", success: "good", partial_recovered: "warning", failed: "critical" } as const;
const OUTCOME_LABEL = { in_progress: "em curso", success: "concluído", partial_recovered: "recuperado parcialmente", failed: "falhou" } as const;
const EXCHANGE_LABEL: Record<string, string> = { binance: "Binance", bybit: "Bybit" };

/** Linha da "waterfall" de execução — a auditoria passo-a-passo de uma
 *  operação (secção 8-11: detectada → validada → ordens enviadas →
 *  preenchidas/recuperadas → concluída). */
function TradeEventsWaterfall({ events }: { events: TradeEventRow[] }) {
  if (events.length === 0) {
    return <p className="py-2 text-xs text-[var(--muted)]">Sem eventos registados para esta operação.</p>;
  }
  return (
    <ol className="flex flex-col gap-1.5 py-2 pl-1 text-xs">
      {events.map((e, i) => (
        <li key={i} className="flex items-baseline gap-2">
          <span className="tabular w-20 shrink-0 text-[var(--muted)]">{new Date(e.at).toLocaleTimeString("pt-PT")}</span>
          <span className="font-medium">{e.event}</span>
          {e.detail ? <span className="text-[var(--muted)]">— {e.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function TradesTable({ trades, eventsByTradeId = {} }: { trades: Trade[]; eventsByTradeId?: Record<string, TradeEventRow[]> }) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return trades;
    const q = query.trim().toUpperCase();
    return trades.filter((t) => `${t.pair} ${t.buyExchange} ${t.sellExchange}`.toUpperCase().includes(q));
  }, [trades, query]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort<Trade, SortKey>(
    filtered,
    (t, key) => {
      switch (key) {
        case "startedAt": return new Date(t.startedAt).getTime();
        case "profitRealUsdt": return Number(t.profitRealUsdt);
        default: return null;
      }
    },
    "startedAt",
    "desc"
  );

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

  if (trades.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Ainda nenhuma operação executada — o robô só age quando encontra uma oportunidade líquida real.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <TableFilterInput
        value={query}
        onChange={(v) => { setQuery(v); goToPage(1); }}
        placeholder="Filtrar por par ou exchange (ex.: BTC, binance)..."
      />
      <ScrollTable maxHeight="32rem">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="w-6 px-2 py-2" />
              <SortHeader label="Quando" sortKey="startedAt" active={sortKey === "startedAt"} dir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2 font-medium">Par</th>
              <th className="px-3 py-2 font-medium">Rota</th>
              <th className="px-3 py-2 font-medium">Qtd</th>
              <th className="px-3 py-2 font-medium">Lucro estimado</th>
              <SortHeader label="Lucro real" sortKey="profitRealUsdt" active={sortKey === "profitRealUsdt"} dir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2 font-medium">Duração</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((t) => {
              const expanded = expandedId === t.id;
              return (
                <>
                  <tr
                    key={t.id}
                    className="cursor-pointer border-t border-[var(--border)] align-top hover:bg-[var(--surface-2)]"
                    onClick={() => setExpandedId(expanded ? null : t.id)}
                  >
                    <td className="px-2 py-2">
                      <ChevronRight className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--muted)]">
                      {new Date(t.startedAt).toLocaleString("pt-PT")}
                    </td>
                    <td className="px-3 py-2 font-medium">{t.pair}</td>
                    <td className="px-3 py-2">{EXCHANGE_LABEL[t.buyExchange]} → {EXCHANGE_LABEL[t.sellExchange]}</td>
                    <td className="tabular px-3 py-2">{t.quantity}</td>
                    <td className="tabular px-3 py-2">{formatUsdt(t.profitEstimatedUsdt)}</td>
                    <td className={`tabular px-3 py-2 font-semibold ${Number(t.profitRealUsdt) >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"}`}>
                      {formatUsdt(t.profitRealUsdt)}
                    </td>
                    <td className="tabular px-3 py-2">{t.executionTimeMs !== null ? `${t.executionTimeMs}ms` : "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={OUTCOME_TONE[t.outcome]}>{OUTCOME_LABEL[t.outcome]}</Badge>
                      {t.errorMessage ? <p className="mt-1 max-w-xs text-[10px] text-[var(--muted)]">{t.errorMessage}</p> : null}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr key={`${t.id}-events`} className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                      <td className="px-2" />
                      <td colSpan={8} className="px-3">
                        <TradeEventsWaterfall events={eventsByTradeId[t.id] ?? []} />
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={PAGE_SIZE} onPageChange={goToPage} />
      </ScrollTable>
    </div>
  );
}
