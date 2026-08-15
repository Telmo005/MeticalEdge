"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import type { IntlTrade } from "@/db/schema";

const PLATFORM_LABEL: Record<string, string> = {
  binance_p2p: "Binance P2P",
  bybit_p2p: "Bybit P2P",
};

function formatUsd(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " USD";
}

export function IntlTradesTable({ trades }: { trades: IntlTrade[] }) {
  if (trades.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Ainda não registaste nenhum ciclo executado. Depois de comprares e venderes de acordo com uma
        recomendação, regista aqui — é o único jeito de saberes se o lucro real bate certo com o estimado.
      </p>
    );
  }

  const totalNet = trades.reduce((s, t) => s + Number(t.netProfitUsd), 0);
  const wins = trades.filter((t) => Number(t.netProfitUsd) > 0).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--muted)]">
        <span>
          Lucro líquido total: <b className={totalNet >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"}>{formatUsd(totalNet)}</b>
        </span>
        <span>
          Taxa de sucesso: <b className="text-[var(--foreground)]">{trades.length > 0 ? `${Math.round((wins / trades.length) * 100)}%` : "—"}</b>
        </span>
        <span>
          Ciclos registados: <b className="text-[var(--foreground)]">{trades.length}</b>
        </span>
      </div>
      <ScrollTable>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Par</th>
              <th className="px-3 py-2">Comprou em</th>
              <th className="px-3 py-2">Vendeu em</th>
              <th className="px-3 py-2 text-right">Capital</th>
              <th className="px-3 py-2 text-right">Lucro líquido</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 text-[var(--muted)]">
                  {new Date(t.executedAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-3 py-2 font-medium">{t.pair}</td>
                <td className="px-3 py-2">{PLATFORM_LABEL[t.platformBuy] ?? t.platformBuy}</td>
                <td className="px-3 py-2">{PLATFORM_LABEL[t.platformSell] ?? t.platformSell}</td>
                <td className="tabular px-3 py-2 text-right">{formatUsd(t.capitalUsedUsd)}</td>
                <td className="px-3 py-2 text-right">
                  <Badge tone={Number(t.netProfitUsd) >= 0 ? "good" : "critical"}>{formatUsd(t.netProfitUsd)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
