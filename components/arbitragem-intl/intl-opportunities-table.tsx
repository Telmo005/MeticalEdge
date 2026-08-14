"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

function formatUsd(value: string | number | null): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " USD";
}

/** Só a leitura MAIS RECENTE de cada combinação par+direcção — para não
 *  mostrar 20 linhas antigas do mesmo par enquanto o histórico cresce. */
function latestPerDirection(opportunities: IntlOpportunity[]): IntlOpportunity[] {
  const seen = new Map<string, IntlOpportunity>();
  for (const o of opportunities) {
    const key = `${o.pair}:${o.platformBuy}:${o.platformSell}`;
    if (!seen.has(key)) seen.set(key, o);
  }
  return [...seen.values()];
}

function RecommendationCard({ o }: { o: IntlOpportunity }) {
  return (
    <Card className="border-[var(--good)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{o.pair} · {o.region}</div>
          <div className="mt-1 text-sm">
            <span className="font-semibold">Comprar</span> em {platformLabel(o.platformBuy)} a {o.bestAsk}
            {" → "}
            <span className="font-semibold">Vender</span> em {platformLabel(o.platformSell)} a {o.bestBid}
          </div>
        </div>
        <Badge tone="good">Lucro líquido {formatPct(o.spreadNetPct)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <span>Lucro estimado com {formatUsd(o.capitalUsd)}: {formatUsd(o.profitAtCapitalUsd)}</span>
        <span>Spread bruto: {formatPct(o.spreadGrossPct)}</span>
        <span>{timeAgo(new Date(o.collectedAt))}</span>
      </div>
    </Card>
  );
}

export function IntlOpportunitiesTable({ opportunities }: { opportunities: IntlOpportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Ainda sem dados — o scan corre em <code>/api/cron/arbitrage-scan-intl</code> a cada vez que o teu
        agendador externo o chamar. Assim que houver a primeira leitura, aparece aqui.
      </p>
    );
  }

  const latest = latestPerDirection(opportunities);
  const viableNow = latest.filter((o) => o.isViable).sort((a, b) => Number(b.spreadNetPct) - Number(a.spreadNetPct));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold">O que fazer agora</h2>
        {viableNow.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nenhuma oportunidade viável neste momento (nem uma das {latest.length} combinações par/direcção
            monitorizadas passa o limiar mínimo). Volta a olhar daqui a pouco — os preços mudam ao longo do
            dia.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {viableNow.map((o) => (
              <RecommendationCard key={`${o.pair}-${o.platformBuy}-${o.platformSell}`} o={o} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Todas as combinações monitorizadas (última leitura)</h2>
        <ScrollTable>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Par</th>
                <th className="px-3 py-2">Comprar em</th>
                <th className="px-3 py-2">Vender em</th>
                <th className="px-3 py-2 text-right">Spread líquido</th>
                <th className="px-3 py-2">Viável</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((o) => (
                <tr key={`${o.pair}-${o.platformBuy}-${o.platformSell}`} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-[var(--muted)]">{timeAgo(new Date(o.collectedAt))}</td>
                  <td className="px-3 py-2 font-medium">{o.pair}</td>
                  <td className="px-3 py-2">{platformLabel(o.platformBuy)}</td>
                  <td className="px-3 py-2">{platformLabel(o.platformSell)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatPct(o.spreadNetPct)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={o.isViable ? "good" : "neutral"}>{o.isViable ? "Sim" : "Não"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      </div>
    </div>
  );
}
