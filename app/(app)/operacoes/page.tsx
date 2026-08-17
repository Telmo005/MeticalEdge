import Link from "next/link";
import { getRecentTrades, getTradeStats, getPerformanceByRoute, getPerformanceByPair, getTradeEventsMap } from "@/lib/queries";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TradesTable } from "@/components/dashboard/trades-table";
import { formatUsdt, formatPct } from "@/lib/utils";

const EXCHANGE_LABEL: Record<string, string> = { binance: "Binance", bybit: "Bybit" };

export default async function OperacoesPage({ searchParams }: { searchParams: Promise<{ paper?: string }> }) {
  const { paper } = await searchParams;
  const isPaper = paper === "1";

  const [trades, stats, byRoute, byPair, eventsByTradeId] = await Promise.all([
    getRecentTrades(500, isPaper),
    getTradeStats(isPaper),
    getPerformanceByRoute(),
    getPerformanceByPair(),
    getTradeEventsMap(isPaper, 500),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Histórico de operações</h1>
            {isPaper ? <Badge tone="neutral">⚪ simuladas</Badge> : null}
          </div>
          <p className="text-sm text-[var(--muted)]">
            {isPaper ? "Todas as operações simuladas (paper trading)." : "Todas as operações reais executadas pelo robô (secção 24)."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href={isPaper ? "/operacoes" : "/operacoes?paper=1"} className="text-[var(--accent-2)] hover:underline">
            {isPaper ? "ver operações reais" : "ver simulações"}
          </Link>
          <a href={`/api/export/trades${isPaper ? "?paper=1" : ""}`} className="text-[var(--accent-2)] hover:underline">
            exportar CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardLabel>Total</CardLabel>
          <div className="tabular text-xl">{stats.totalTrades}</div>
        </Card>
        <Card>
          <CardLabel>Lucro líquido total</CardLabel>
          <div className="tabular text-xl">{formatUsdt(stats.totalProfitUsdt)}</div>
        </Card>
        <Card>
          <CardLabel>Win rate</CardLabel>
          <div className="tabular text-xl">{stats.totalTrades > 0 ? `${stats.winRatePct.toFixed(0)}%` : "—"}</div>
        </Card>
        <Card>
          <CardLabel>Recuperadas / falhadas</CardLabel>
          <div className="tabular text-xl">{stats.partialCount} / {stats.failedCount}</div>
        </Card>
      </div>

      <Card>
        <TradesTable trades={trades} eventsByTradeId={eventsByTradeId} />
      </Card>

      {!isPaper ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardLabel>Desempenho por rota</CardLabel>
            {byRoute.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Sem dados ainda.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {byRoute.map((r) => (
                  <li key={`${r.buyExchange}-${r.sellExchange}`} className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                    <span>{EXCHANGE_LABEL[r.buyExchange]} → {EXCHANGE_LABEL[r.sellExchange]} ({r.count})</span>
                    <span className="tabular">{formatPct(r.avgProfitPct)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardLabel>Desempenho por par</CardLabel>
            {byPair.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Sem dados ainda.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {byPair.map((p) => (
                  <li key={p.pair} className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                    <span>{p.pair} ({p.count})</span>
                    <span className="tabular">{formatPct(p.avgProfitPct)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
