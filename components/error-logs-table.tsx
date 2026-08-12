"use client";

import { useMemo, useState } from "react";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Pagination } from "@/components/ui/pagination";
import { TableFilterInput } from "@/components/ui/table-filter-input";
import { SortHeader } from "@/components/ui/sort-header";
import { usePagination } from "@/lib/use-pagination";
import { useSort } from "@/lib/use-sort";
import type { ErrorLogEntry } from "@/db/schema";

const PAGE_SIZE = 10;
type SortKey = "createdAt" | "source" | "message";

export function ErrorLogsTable({ logs }: { logs: ErrorLogEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return logs;
    const q = query.trim().toLowerCase();
    return logs.filter((l) => l.source.toLowerCase().includes(q) || l.message.toLowerCase().includes(q));
  }, [logs, query]);

  const { sorted, sortKey, sortDir, toggleSort } = useSort<ErrorLogEntry, SortKey>(
    filtered,
    (l, key) => {
      switch (key) {
        case "createdAt": return new Date(l.createdAt).getTime();
        case "source": return l.source;
        case "message": return l.message;
        default: return null;
      }
    },
    "createdAt",
    "desc"
  );

  const { page, totalPages, pageItems, goToPage, totalItems } = usePagination(sorted, PAGE_SIZE);

  if (logs.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Sem erros registados — bom sinal.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <TableFilterInput value={query} onChange={(v) => { setQuery(v); goToPage(1); }} placeholder="Filtrar por origem ou mensagem..." />
      <ScrollTable maxHeight="24rem">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <SortHeader label="Quando" sortKey="createdAt" active={sortKey === "createdAt"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Origem" sortKey="source" active={sortKey === "source"} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Mensagem" sortKey="message" active={sortKey === "message"} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nenhum erro corresponde a &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              pageItems.map((l) => (
                <tr key={l.id} className="border-t border-[var(--border)] align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--muted)]">
                    {new Date(l.createdAt).toLocaleString("pt-PT")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-[var(--critical)]">{l.source}</td>
                  <td className="px-3 py-2 text-[var(--foreground)]">{l.message}</td>
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
