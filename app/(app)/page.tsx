import Link from "next/link";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import {
  getSettings,
  getLatestSnapshot,
  getRecentOpportunities,
  getTradeStats,
  getPendingOperations,
  getCapitalPosition,
  getRecentIntlOpportunities,
} from "@/lib/queries";
import { costPreferencesFrom } from "@/lib/cost-prefs";
import { findBestAdPairs } from "@/lib/p2p/optimizer";
import { getTimingInsight } from "@/lib/p2p/patterns";
import { TimingCard } from "@/components/dashboard/timing-card";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/refresh-button";
import { ExecutionPlan } from "@/components/execution-plan";
import { OpportunitiesHistoryTable } from "@/components/dashboard/opportunities-history-table";
import { MarketIntelligenceCard } from "@/components/dashboard/market-intelligence-card";
import { PriceHistoryChart } from "@/components/dashboard/price-history-chart";
import { getPriceExtremes, getReferenceDivergenceSignal, getPriceHistory } from "@/lib/p2p/price-intelligence";
import { analyzeTopAdLifecycle } from "@/lib/p2p/ad-lifecycle";
import { OnboardingWelcome } from "@/components/onboarding-welcome";
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
  const config = await getSettings();
  if (Number(config?.currentCapitalMzn ?? 0) === 0) {
    return <OnboardingWelcome />;
  }

  const [snapshot, opportunitiesList, stats, pendingOps, capital, intlOpportunitiesList] = await Promise.all([
    getLatestSnapshot(),
    getRecentOpportunities(200),
    getTradeStats(),
    getPendingOperations(),
    getCapitalPosition(),
    getRecentIntlOpportunities(40),
  ]);

  // Só a leitura mais recente de cada combinação par+direcção, mesma lógica
  // de components/arbitragem-intl/intl-opportunities-table.tsx — aqui só
  // precisamos da melhor para um resumo de uma linha no painel principal.
  const latestIntlByDirection = new Map<string, (typeof intlOpportunitiesList)[number]>();
  for (const o of intlOpportunitiesList) {
    const key = `${o.pair}:${o.platformBuy}:${o.platformSell}`;
    if (!latestIntlByDirection.has(key)) latestIntlByDirection.set(key, o);
  }
  const bestIntlOpportunity = [...latestIntlByDirection.values()]
    .filter((o) => o.isViable)
    .sort((a, b) => Number(b.spreadNetPct) - Number(a.spreadNetPct))[0] ?? null;

  const [priceExtremes, askLifecycle, bidLifecycle, divergence, priceHistory] = await Promise.all([
    getPriceExtremes(),
    analyzeTopAdLifecycle("ask"),
    analyzeTopAdLifecycle("bid"),
    getReferenceDivergenceSignal(
      snapshot?.bestAsk == null ? null : Number(snapshot.bestAsk),
      snapshot?.bestBid == null ? null : Number(snapshot.bestBid),
      snapshot?.referenceUsdMzn == null ? null : Number(snapshot.referenceUsdMzn)
    ),
    getPriceHistory(24),
  ]);

  const latestOpportunity = opportunitiesList[0] ?? null;

  // Padrões de hora/dia a partir do histórico já guardado, e a melhor
  // combinação "compro a este, vendo àquele" com o capital que está mesmo
  // livre — dois motores de lucro que a app não tinha.
  const timing = await getTimingInsight(30);
  const costPrefs = costPreferencesFrom(config);
  const bestPair =
    snapshot && capital.availableMzn > 0
      ? findBestAdPairs(snapshot.askAds ?? [], snapshot.bidAds ?? [], capital.availableMzn, costPrefs, 1)[0] ??
        null
      : null;

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

      {pendingOps.length > 0 ? (
        <Link href="/operacoes">
          <Card className="flex items-center justify-between gap-3 border-l-4 border-l-[var(--warning)] transition-colors hover:bg-[var(--surface-2)]">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {pendingOps.length} {pendingOps.length === 1 ? "operação" : "operações"} à espera de vender
              </p>
              <p className="text-xs text-[var(--muted)]">
                {formatMzn(pendingOps.reduce((s, o) => s + Number(o.capitalUsedMzn), 0))} em capital preso — toca
                para ver
              </p>
            </div>
            <Badge tone="warning">ver operações</Badge>
          </Card>
        </Link>
      ) : null}

      <Link href="/arbitragem-intl">
        <Card
          className={`flex items-center justify-between gap-3 transition-colors hover:bg-[var(--surface-2)] ${
            bestIntlOpportunity ? "border-l-4 border-l-[var(--good)]" : "border-l-4 border-l-[var(--border)]"
          }`}
        >
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Arbitragem internacional (Binance × Bybit)</p>
            {bestIntlOpportunity ? (
              <p className="text-xs text-[var(--muted)]">
                Melhor agora: {bestIntlOpportunity.pair}, {formatPct(bestIntlOpportunity.spreadNetPct)} líquido — toca
                para ver
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">Nenhuma oportunidade viável neste momento — toca para ver todas</p>
            )}
          </div>
          <Badge tone={bestIntlOpportunity ? "good" : "neutral"}>
            {latestIntlByDirection.size > 0 ? `${latestIntlByDirection.size} combinações` : "ver"}
          </Badge>
        </Card>
      </Link>

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
              <CardLabel>Livre para operar</CardLabel>
              <div className="tabular text-xl">{formatMzn(capital.availableMzn)}</div>
              {capital.lockedMzn > 0 ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {formatMzn(capital.lockedMzn)} presos em operações por fechar
                </p>
              ) : (
                <Link href="/settings" className="mt-1 inline-block text-xs text-[var(--accent-2)] hover:underline">
                  alterar
                </Link>
              )}
            </Card>
          </div>
        )}
      </section>

      {bestPair ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Melhor jogada neste momento</h2>
          <Card className="border-l-4 border-l-[var(--good)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Uma ordem de cada lado</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Comprar a um comerciante e vender a outro, sem repartir — metade das taxas fixas e muito
                  menos tempo exposto ao mercado. A varredura clássica não testa estas combinações.
                </p>
              </div>
              <div className="text-right">
                <CardLabel>Lucro líquido</CardLabel>
                <div className="tabular text-xl font-bold text-[var(--good)]">
                  +{formatMzn(bestPair.netMzn)}
                </div>
                <p className="text-xs text-[var(--muted)]">{formatPct(bestPair.netPct)}</p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <CardLabel>Compras a</CardLabel>
                <div className="truncate text-sm font-medium">{bestPair.buyAd.merchantName}</div>
                <div className="tabular text-xs text-[var(--muted)]">
                  {formatMzn(bestPair.buyAd.price)}/USDT
                </div>
              </div>
              <div>
                <CardLabel>Vendes a</CardLabel>
                <div className="truncate text-sm font-medium">{bestPair.sellAd.merchantName}</div>
                <div className="tabular text-xs text-[var(--muted)]">
                  {formatMzn(bestPair.sellAd.price)}/USDT
                </div>
              </div>
              <div>
                <CardLabel>Valor a negociar</CardLabel>
                <div className="tabular text-sm">{formatMzn(bestPair.spendMzn)}</div>
                <div className="tabular text-xs text-[var(--muted)]">{formatUsdt(bestPair.usdtAmount)}</div>
              </div>
              <div>
                <CardLabel>Diferença de preço</CardLabel>
                <div className="tabular text-sm">{formatPct(bestPair.spreadPct)}</div>
              </div>
            </div>

            <Link href={`/simulacao?capital=${Math.round(bestPair.spendMzn)}&modo=equilibrado-1`}>
              <Button variant="secondary">Ver plano completo na simulação</Button>
            </Link>
          </Card>
        </section>
      ) : null}

      {snapshot ? (
        <section>
          <PriceHistoryChart points={priceHistory} hours={24} />
        </section>
      ) : null}

      {timing.reliable ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
            Quando é que este mercado costuma estar bom
          </h2>
          <TimingCard timing={timing} />
        </section>
      ) : null}

      {snapshot ? (
        <section>
          <MarketIntelligenceCard
            bestAsk={snapshot.bestAsk === null ? null : Number(snapshot.bestAsk)}
            bestBid={snapshot.bestBid === null ? null : Number(snapshot.bestBid)}
            extremes={priceExtremes}
            askLifecycle={askLifecycle}
            bidLifecycle={bidLifecycle}
            divergence={divergence}
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
                    ? "Dentro das regras de segurança"
                    : "Com avisos — decide tu se avanças"}
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
                  Avisos — o plano abaixo é sempre mostrado, decide tu com esta informação
                </p>
                <ul className="list-inside list-disc text-sm text-[var(--foreground)]">
                  {latestOpportunity.reasonsBlocked.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {latestOpportunity.detail.buySteps.length > 0 && latestOpportunity.detail.sellSteps.length > 0 ? (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  O que fazer agora
                </p>
                <ExecutionPlan
                  buySteps={latestOpportunity.detail.buySteps}
                  sellSteps={latestOpportunity.detail.sellSteps}
                  netMzn={Number(latestOpportunity.netProfitMediumMzn)}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/trades/new?opportunityId=${latestOpportunity.id}`}>
                    <Button>Já executei — registar operação</Button>
                  </Link>
                  <Link href={`/operacoes/nova?opportunityId=${latestOpportunity.id}`}>
                    <Button variant="secondary">Comprei — falta vender</Button>
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
