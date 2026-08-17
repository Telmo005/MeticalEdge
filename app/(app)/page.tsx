import Link from "next/link";
import { Info } from "lucide-react";
import {
  getBotSettings,
  getExchangeBalances,
  getExchangeHealth,
  getHeartbeat,
  getMaxDrawdown,
  getPaperBalances,
  getRecentOpportunitiesSummary,
  getRecentTrades,
  getSpreadHistory,
  getTodayNetProfitUsdt,
  getTradeStats,
  getOpportunityCounts,
  getCapitalHistory,
} from "@/lib/queries";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoneyStat } from "@/components/ui/stat";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { CapitalChart } from "@/components/capital-chart";
import { WalletBreakdown } from "@/components/dashboard/wallet-breakdown";
import { ExchangeHealthCard } from "@/components/dashboard/exchange-health-card";
import { SpreadHistoryChart } from "@/components/dashboard/spread-history-chart";
import { setBothExchangeBalancesFormAction, engageKillSwitchAction, resumeBotAction, resetPaperBalancesAction } from "@/lib/actions/bot";
import { formatUsdt, formatPct } from "@/lib/utils";
import { EXCHANGE_IDS } from "@/lib/exchange/registry";

const STATUS_LABEL: Record<string, string> = {
  scanning: "PROCURANDO OPORTUNIDADES",
  opportunity_found: "OPORTUNIDADE ENCONTRADA",
  validating: "A VALIDAR",
  executing: "A EXECUTAR",
  partially_filled: "PARCIALMENTE PREENCHIDA",
  completed: "CONCLUÍDA",
  recovery: "EM RECUPERAÇÃO",
  paused: "PARADO",
  error: "ERRO",
};

const EXCHANGE_LABEL: Record<string, string> = { binance: "Binance", bybit: "Bybit" };

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

export default async function DashboardPage() {
  const settings = await getBotSettings();
  const isPaper = settings.mode === "paper";
  const initialBalance = Number(settings?.initialBalanceUsdt ?? 0);

  // Em modo live sem nenhum depósito real ainda, pede o onboarding antes de
  // mostrar o resto — em modo paper não bloqueia nada, já que não precisa
  // de capital real nenhum para simular.
  if (!isPaper && initialBalance === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">Bem-vindo</h1>
          <p className="text-sm text-[var(--muted)]">
            Regista o capital pré-distribuído nas duas exchanges (secção 1): USDT na Binance para comprar, e o
            valor em USDT do activo já reservado na Bybit para vender.
          </p>
        </div>
        <Card>
          <CardTitle>Capital inicial</CardTitle>
          <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
            Sem chaves API configuradas, estes valores só servem para o motor calcular o tamanho das operações a
            avaliar — nenhuma ordem real é executada até haver chaves nas duas exchanges. Com chaves, o worker
            passa a sincronizar os saldos reais sozinho.
          </p>
          <form action={setBothExchangeBalancesFormAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="binanceUsdt">Binance — USDT para comprar</Label>
              <Input id="binanceUsdt" name="binanceUsdt" type="number" step="0.01" min="0" defaultValue={10} className="w-full sm:w-48" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bybitUsdt">Bybit — valor do activo para vender</Label>
              <Input id="bybitUsdt" name="bybitUsdt" type="number" step="0.01" min="0" defaultValue={10} className="w-full sm:w-48" />
            </div>
            <SubmitButton pendingText="A guardar...">Confirmar capital</SubmitButton>
          </form>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Preferes testar sem capital real primeiro? Muda para modo Paper em <Link href="/settings" className="text-[var(--accent-2)] hover:underline">/settings</Link>.
          </p>
        </Card>
      </div>
    );
  }

  const [
    heartbeat,
    opportunities,
    trades,
    stats,
    counts24h,
    capitalHistory,
    exchangeBalances,
    paperBalances,
    exchangeHealthRows,
    todayNet,
    spreadSeries,
  ] = await Promise.all([
    getHeartbeat(),
    getRecentOpportunitiesSummary(20),
    getRecentTrades(10, isPaper),
    getTradeStats(isPaper),
    getOpportunityCounts(24),
    getCapitalHistory(100, isPaper),
    getExchangeBalances(),
    getPaperBalances(),
    getExchangeHealth(),
    getTodayNetProfitUsdt(isPaper),
    Promise.all(settings.watchedPairs.map(async (pair) => ({ pair, points: await getSpreadHistory(pair, 24) }))),
  ]);
  const drawdown = getMaxDrawdown(capitalHistory);

  const killSwitchOn = settings?.killSwitchEngaged ?? false;
  const activeBalances = isPaper ? paperBalances : exchangeBalances;
  const currentBalance = activeBalances.reduce((sum, b) => sum + Number(b.totalValueUsdt), 0);
  const displayInitial = isPaper ? 20 : initialBalance;

  const statusKey = killSwitchOn ? "paused" : (heartbeat?.status ?? "scanning");
  const status = STATUS_LABEL[statusKey] ?? statusKey.toUpperCase();
  const statusTone =
    statusKey === "error" || statusKey === "paused"
      ? "critical"
      : statusKey === "executing" || statusKey === "recovery" || statusKey === "partially_filled"
        ? "warning"
        : "good";

  const profitTotal = currentBalance - displayInitial;
  const profitPct = displayInitial > 0 ? (profitTotal / displayInitial) * 100 : 0;

  const bestNow = opportunities.find((o) => o.passedFilters) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Painel</h1>
            <Badge tone={isPaper ? "neutral" : "critical"}>{isPaper ? "⚪ SIMULAÇÃO" : "🔴 REAL"}</Badge>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Compara Binance e Bybit em tempo real e só age quando comprar numa e vender na outra dá lucro líquido
            real, depois de taxas, slippage e margem de segurança.
          </p>
        </div>
        <form action={killSwitchOn ? resumeBotAction : engageKillSwitchAction}>
          <SubmitButton
            variant={killSwitchOn ? "secondary" : "danger"}
            pendingText={killSwitchOn ? "A retomar..." : "A parar..."}
            confirmMessage={killSwitchOn ? undefined : "Parar o bot? Nenhuma nova operação será iniciada até retomares."}
          >
            {killSwitchOn ? "Retomar bot" : "PARAR BOT"}
          </SubmitButton>
        </form>
      </div>

      {isPaper ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[var(--accent-2)]">
          <p className="text-sm text-[var(--muted)]">
            <b className="text-[var(--foreground)]">Modo simulação:</b> dados de mercado 100% reais, nenhuma ordem
            real é enviada. Capital simulado começa em 10+10 USDT.
          </p>
          <form action={resetPaperBalancesAction}>
            <SubmitButton variant="secondary" pendingText="A repor..." confirmMessage="Repor o capital simulado a 10/10 USDT e apagar o histórico de trades simulados?">
              Reiniciar simulação
            </SubmitButton>
          </form>
        </Card>
      ) : (
        <Card className="flex items-start gap-3 border-l-4 border-l-[var(--accent-2)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-2)]" />
          <p className="text-sm text-[var(--muted)]">
            <b className="text-[var(--foreground)]">Como funciona:</b> o capital fica sempre pré-distribuído — USDT
            numa exchange, o activo na outra — e nunca é transferido durante a arbitragem.
          </p>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Carteiras</h2>
          <a href={`/api/export/trades${isPaper ? "?paper=1" : ""}`} className="text-xs text-[var(--accent-2)] hover:underline">
            exportar CSV
          </a>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {activeBalances.map((b) => (
            <WalletBreakdown
              key={b.exchangeId}
              exchangeId={b.exchangeId}
              totalValueUsdt={Number(b.totalValueUsdt)}
              usdtFree={Number(b.usdtFree)}
              assetsDetail={isPaper ? [] : (exchangeBalances.find((e) => e.exchangeId === b.exchangeId)?.assetsDetail ?? [])}
              updatedAt={b.updatedAt}
            />
          ))}
          <Card>
            <CardLabel>Total {isPaper ? "(simulado)" : ""}</CardLabel>
            <div className="tabular text-xl font-semibold">{formatUsdt(currentBalance)}</div>
          </Card>
        </div>
        {heartbeat?.rebalanceRecommended ? (
          <p className="mt-2 text-xs text-[var(--warning)]">⚠ {heartbeat.rebalanceReason}</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Saúde das exchanges</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EXCHANGE_IDS.map((id) => {
            const h = exchangeHealthRows.find((r) => r.exchangeId === id);
            return (
              <ExchangeHealthCard
                key={id}
                exchangeId={id}
                lastSuccessAt={h?.lastSuccessAt ?? null}
                lastErrorAt={h?.lastErrorAt ?? null}
                lastErrorMessage={h?.lastErrorMessage ?? null}
                avgLatencyMs={h?.avgLatencyMs ?? null}
              />
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Estado do robô</h2>
          {heartbeat ? <span className="text-xs text-[var(--muted)]">actualizado {timeAgo(new Date(heartbeat.at))}</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardLabel>Status</CardLabel>
            <Badge tone={statusTone}>{status}</Badge>
            {heartbeat?.statusDetail ? <p className="mt-1 text-xs text-[var(--muted)]">{heartbeat.statusDetail}</p> : null}
          </Card>
          <MoneyStat
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
            label="Lucro total"
            amountUsdt={profitTotal}
            hint={formatPct(profitPct)}
          />
          <MoneyStat
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
            label="P&L hoje"
            amountUsdt={todayNet}
          />
          <Card>
            <CardLabel>Maior queda</CardLabel>
            <div className="tabular text-xl text-[var(--critical)]">{formatUsdt(drawdown.maxDrawdownUsdt)}</div>
            <p className="mt-1 text-xs text-[var(--muted)]">{formatPct(-drawdown.maxDrawdownPct)}</p>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Desempenho</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardLabel>Trades</CardLabel>
            <div className="tabular text-xl">{stats.totalTrades}</div>
            <p className="mt-1 text-xs text-[var(--muted)]">win rate {stats.winRatePct.toFixed(0)}%</p>
          </Card>
          <Card>
            <CardLabel>Lucrativas</CardLabel>
            <div className="tabular text-xl text-[var(--good)]">{stats.winCount}</div>
          </Card>
          <Card>
            <CardLabel>Perdedoras</CardLabel>
            <div className="tabular text-xl text-[var(--critical)]">{stats.lossCount}</div>
          </Card>
          <Card>
            <CardLabel>Oportunidades (24h)</CardLabel>
            <div className="tabular text-xl">
              {counts24h.passed}
              <span className="text-sm text-[var(--muted)]"> / {counts24h.total}</span>
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Evolução do saldo {isPaper ? "(simulado)" : ""}</h2>
        <Card>
          <CapitalChart history={capitalHistory} />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Margem líquida por par (24h)</h2>
        <Card>
          <SpreadHistoryChart series={spreadSeries} />
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Melhor oportunidade agora</h2>
          <Link href="/oportunidades" className="text-xs text-[var(--accent-2)] hover:underline">
            ver ranking completo
          </Link>
        </div>
        {!bestNow ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">Nenhuma oportunidade dentro das regras de segurança neste momento — o robô só espera (secção 38).</p>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-[var(--good)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{bestNow.pair}</CardTitle>
              <span className="text-xs text-[var(--muted)]">avaliada {timeAgo(new Date(bestNow.detectedAt))}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-6 text-sm">
              <div>
                <CardLabel>Comprar</CardLabel>
                <div>{EXCHANGE_LABEL[bestNow.buyExchange]} — <span className="tabular">{formatUsdt(bestNow.buyPrice, 2)}</span></div>
              </div>
              <div>
                <CardLabel>Vender</CardLabel>
                <div>{EXCHANGE_LABEL[bestNow.sellExchange]} — <span className="tabular">{formatUsdt(bestNow.sellPrice, 2)}</span></div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <CardLabel>Spread bruto</CardLabel>
                <div className="tabular">{formatPct(bestNow.grossSpreadPct)}</div>
              </div>
              <div>
                <CardLabel>Taxas</CardLabel>
                <div className="tabular">{formatPct(bestNow.feesPct)}</div>
              </div>
              <div>
                <CardLabel>Slippage estimado</CardLabel>
                <div className="tabular">{formatPct(bestNow.estimatedSlippagePct)}</div>
              </div>
              <div>
                <CardLabel>Lucro líquido</CardLabel>
                <div className="tabular font-semibold text-[var(--good)]">{formatPct(bestNow.netPct)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone="good">EXECUTÁVEL</Badge>
              <span className="tabular text-sm text-[var(--muted)]">{formatUsdt(bestNow.netResultUsdt)} sobre {formatUsdt(bestNow.capitalUsdt)}</span>
            </div>
          </Card>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Últimas operações {isPaper ? "(simuladas)" : ""}</h2>
          <Link href="/operacoes" className="text-xs text-[var(--accent-2)] hover:underline">
            ver histórico completo
          </Link>
        </div>
        {trades.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">Ainda nenhuma operação {isPaper ? "simulada" : "executada"}.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {trades.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {t.pair} — {EXCHANGE_LABEL[t.buyExchange]} → {EXCHANGE_LABEL[t.sellExchange]}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{new Date(t.startedAt).toLocaleString("pt-PT")}</p>
                </div>
                <span className={`tabular text-sm font-semibold ${Number(t.profitRealUsdt) >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"}`}>
                  {formatUsdt(t.profitRealUsdt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
