"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { formatPct } from "@/lib/utils";
import type { IntlOpportunity } from "@/db/schema";

const PLATFORM_LABEL: Record<string, string> = {
  binance_p2p: "Binance P2P",
  bybit_p2p: "Bybit P2P",
};

function platformLabel(id: string): string {
  return PLATFORM_LABEL[id] ?? id;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

export function IntlOpportunitiesTable({ opportunities }: { opportunities: IntlOpportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Ainda sem dados. O scan corre em <code>/api/cron/arbitrage-scan-intl</code>, mas só produz
        oportunidades para pares com uma segunda plataforma já configurada (ver
        <code> lib/p2p/intl/pairs-config.ts</code>).
      </p>
    );
  }

  return (
    <ScrollTable>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
          <tr>
            <th className="px-3 py-2">Quando</th>
            <th className="px-3 py-2">Par</th>
            <th className="px-3 py-2">Região</th>
            <th className="px-3 py-2">Compra</th>
            <th className="px-3 py-2">Venda</th>
            <th className="px-3 py-2 text-right">Spread bruto</th>
            <th className="px-3 py-2 text-right">Spread líquido</th>
            <th className="px-3 py-2">Viável</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr key={o.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2 text-[var(--muted)]">{timeAgo(new Date(o.collectedAt))}</td>
              <td className="px-3 py-2 font-medium">{o.pair}</td>
              <td className="px-3 py-2">{o.region}</td>
              <td className="px-3 py-2">{platformLabel(o.platformBuy)}</td>
              <td className="px-3 py-2">{platformLabel(o.platformSell)}</td>
              <td className="tabular px-3 py-2 text-right">{formatPct(o.spreadGrossPct)}</td>
              <td className="tabular px-3 py-2 text-right">{formatPct(o.spreadNetPct)}</td>
              <td className="px-3 py-2">
                <Badge tone={o.isViable ? "good" : "neutral"}>{o.isViable ? "Sim" : "Não"}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}
