import Link from "next/link";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { getSettings, getLatestSnapshot, getRecentOpportunities, getTradeStats } from "@/lib/queries";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/refresh-button";
import { ExecutionPlan } from "@/components/execution-plan";
import { OpportunitiesHistoryTable } from "@/components/dashboard/opportunities-history-table";
import { MarketIntelligenceCard } from "@/components/dashboard/market-intelligence-card";
import { getPriceExtremes } from "@/lib/p2p/price-intelligence";
import { formatMzn, formatPct, formatUsdt } from "@/lib/utils";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

export default async function DashboardPage() {
  const [config, snapshot, opportunitiesList, stats, priceExtremes] = await Promise.all([
    getSettings(),
    getLatestSnapshot(),
    getRecentOpportunities(200),
    getTradeStats(),
    getPriceExtremes(),
  ]);

  const latestOpportunity = opportunitiesList[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Painel</h1>
          <p className="text-sm text-[var(--muted)]">
            Vigia o mercado USDT/MZN sozinho e avisa-te quando há uma oportunidade real.
          </p>
        </div>
        <RefreshButton />
      </div>

      <Card className="flex items-start gap-3 border-l-4 border-l-[var(--accent-2)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-2)]" />
        <p className="text-sm text-[var(--muted)]">
          <b className="text-[var(--foreground)]">Como funciona:</b> o sistema compara o preço mais barato
          para comprar USDT com o preço mais generoso para vender USDT, agora mesmo. Quando a diferença
          cobre as taxas e ainda sobra lucro dentro do capital configurado, aparece aqui em baixo — e chega
          um alerta ao telemóvel. Este sistema não compra nem vende sozinho: diz-te exactamente o que fazer,
          tu executas na app da Binance.
        </p>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Mercado USDT/MZN</h2>
          {snapshot ? (
            <span className="text-xs text-[var(--muted)]">
              actualizado {timeAgo(new Date(snapshot.collectedAt))}
            </span>
          ) : null}
        </div>

        {!snapshot ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              Ainda não há nenhuma varredura registada. Carrega em &quot;Actualizar agora&quot; ou confirma
              que o cron de /api/cron/scan está a correr (ver README).
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardLabel>Melhor compra (ask)</CardLabel>
              <div className="tabular text-xl">{formatMzn(snapshot.bestAsk)}</div>
              <p className="mt-1 text-xs text-[var(--muted)]">preço para tu comprares USDT</p>
            </Card>
            <Card>
              <CardLabel>Melhor venda (bid)</CardLabel>
              <div className="tabular text-xl">{formatMzn(snapshot.bestBid)}</div>
              <p className="mt-1 text-xs text-[var(--muted)]">preço para tu venderes USDT</p>
            </Card>
            <Card>
              <CardLabel>Spread</CardLabel>
              <div className="tabular text-xl">{formatPct(snapshot.spreadPct)}</div>
              <div className="mt-1">
                <Badge tone={snapshot.isCrossed ? "good" : "neutral"}>
                  {snapshot.isCrossed ? "livro cruzado" : "livro normal"}
                </Badge>
              </div>
            </Card>
            <Card>
              <CardLabel>Capital configurado</CardLabel>
              <div className="tabular text-xl">{formatMzn(config?.currentCapitalMzn)}</div>
              <Link href="/settings" className="mt-1 inline-block text-xs text-[var(--accent-2)] hover:underline">
                alterar
              </Link>
            </Card>
          </div>
        )}
      </section>

      {snapshot ? (
        <section>
          <MarketIntelligenceCard
            bestAsk={snapshot.bestAsk === null ? null : Number(snapshot.bestAsk)}
            bestBid={snapshot.bestBid === null ? null : Number(snapshot.bestBid)}
            extremes={priceExtremes}
          />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Oportunidade mais recente</h2>
        {!latestOpportunity ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">Nenhuma avaliação ainda.</p>
          </Card>
        ) : (
          <Card
            className={
              latestOpportunity.meetsEntryRules ? "border-l-4 border-l-[var(--good)]" : "border-l-4 border-l-[var(--border)]"
            }
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {latestOpportunity.meetsEntryRules ? (
                  <CheckCircle2 className="h-5 w-5 text-[var(--good)]" />
                ) : (
                  <XCircle className="h-5 w-5 text-[var(--muted)]" />
                )}
                <CardTitle className="text-base">
                  {latestOpportunity.meetsEntryRules
                    ? "Podes executar agora"
                    : "Não executar agora"}
                </CardTitle>
              </div>
              <span className="text-xs text-[var(--muted)]">
                avaliado {timeAgo(new Date(latestOpportunity.detectedAt))} com{" "}
                {formatMzn(latestOpportunity.capitalMzn)}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <CardLabel>USDT a negociar</CardLabel>
                <div className="tabular">{formatUsdt(latestOpportunity.usdtAmount)}</div>
              </div>
              <div>
                <CardLabel>Ordens necessárias</CardLabel>
                <div className="tabular">{latestOpportunity.nOrders}</div>
              </div>
              <div>
                <CardLabel>Lucro líquido esperado</CardLabel>
                <div className="tabular font-semibold">{formatMzn(latestOpportunity.netProfitMediumMzn)}</div>
              </div>
              <div>
                <CardLabel>ROI líquido</CardLabel>
                <div className="tabular font-semibold">{formatPct(latestOpportunity.netPctMedium)}</div>
              </div>
            </div>

            {latestOpportunity.reasonsBlocked.length > 0 ? (
              <div className="mb-4 rounded-md bg-[var(--warning-bg)] p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
                  Por que não dá para executar agora
                </p>
                <ul className="list-inside list-disc text-sm text-[var(--foreground)]">
                  {latestOpportunity.reasonsBlocked.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {latestOpportunity.meetsEntryRules ? (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  O que fazer agora
                </p>
                <ExecutionPlan
                  buySteps={latestOpportunity.detail.buySteps}
                  sellSteps={latestOpportunity.detail.sellSteps}
                  netMzn={Number(latestOpportunity.netProfitMediumMzn)}
                />
                <div className="mt-4">
                  <Link href={`/trades/new?opportunityId=${latestOpportunity.id}`}>
                    <Button>Já executei — registar operação</Button>
                  </Link>
                </div>
              </>
            ) : null}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Desempenho reportado</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardLabel>Operações</CardLabel>
            <div className="tabular text-xl">{stats.totalTrades}</div>
          </Card>
          <Card>
            <CardLabel>Taxa de sucesso</CardLabel>
            <div className="tabular text-xl">
              {stats.totalTrades > 0 ? `${((Number(stats.wins) / Number(stats.totalTrades)) * 100).toFixed(0)}%` : "—"}
            </div>
          </Card>
          <Card>
            <CardLabel>Lucro líquido total</CardLabel>
            <div className="tabular text-xl">{formatMzn(stats.totalNetProfit)}</div>
          </Card>
          <Card>
            <CardLabel>ROI médio / operação</CardLabel>
            <div className="tabular text-xl">{formatPct(stats.avgNetPct)}</div>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Histórico de avaliações</h2>
        <OpportunitiesHistoryTable opportunities={opportunitiesList} />
      </section>
    </div>
  );
}
