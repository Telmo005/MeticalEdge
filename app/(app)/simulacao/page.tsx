import { getLatestSnapshot, getSettings } from "@/lib/queries";
import { roundTripForCapital, netByScenario, evaluateSellCounterparties } from "@/lib/p2p/analysis";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { RefreshButton } from "@/components/refresh-button";
import { ExecutionPlan } from "@/components/execution-plan";
import { SimulateForm } from "@/components/simulate-form";
import { CounterpartyOptions, type CounterpartyRow } from "@/components/counterparty-options";
import { TrancheKpisChart, type TrancheRow } from "@/components/tranche-kpis-chart";
import { PriceProfitChart, type PricePoint } from "@/components/price-profit-chart";
import { AutoRefresh } from "@/components/auto-refresh";
import { Tabs } from "@/components/ui/tabs";
import { formatMzn, formatUsdt } from "@/lib/utils";
import type { Ad } from "@/lib/p2p/orderbook";

const STANDARD_TRANCHES = [500, 1000, 2000, 5000, 10000];

export default async function SimulacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ capital?: string }>;
}) {
  const [snapshot, config] = await Promise.all([getLatestSnapshot(), getSettings()]);
  const { capital: capitalParam } = await searchParams;

  const askAds: Ad[] = snapshot?.askAds ?? [];
  const bidAds: Ad[] = snapshot?.bidAds ?? [];

  const chosenCapital = Number(capitalParam) || Number(config?.currentCapitalMzn) || 5000;
  const tranches = Array.from(new Set([...STANDARD_TRANCHES, chosenCapital])).sort((a, b) => a - b);

  const rows = tranches.map((capital) => {
    const trip = roundTripForCapital(askAds, bidAds, capital);
    const net = netByScenario(trip);
    return { capital, trip, net };
  });

  const selected = rows.find((r) => r.capital === chosenCapital) ?? rows[0];

  const trancheRows: TrancheRow[] = rows.map(({ capital, trip, net }) => ({
    capital,
    netMzn: net.medio.netMzn,
    netPct: net.medio.netPct,
    nOrders: trip.nOrders,
    fullyFilled: trip.buy.fullyFilled && trip.residualUsdt < 0.0001,
  }));

  const pricePoints: PricePoint[] = rows
    .filter((r) => r.trip.buy.vwapPrice !== null && r.trip.buy.fullyFilled)
    .map(({ capital, trip, net }) => ({
      capital,
      buyPrice: trip.buy.vwapPrice as number,
      netMzn: net.medio.netMzn,
    }));

  const counterparties = evaluateSellCounterparties(askAds, bidAds, chosenCapital);
  const counterpartyRows: CounterpartyRow[] = counterparties.options.map((o) => ({
    merchantName: o.bidAd.merchantName,
    advNo: o.bidAd.advNo,
    price: o.bidAd.price,
    usdtSold: o.usdtSold,
    mznReceived: o.mznReceived,
    residualUsdt: o.residualUsdt,
    netMzn: o.net.medio.netMzn,
    netPct: o.net.medio.netPct,
    usable: o.usable,
    monthOrders: o.bidAd.monthOrders,
    monthFinishRate: o.bidAd.monthFinishRate,
    sellStep: {
      advNo: o.bidAd.advNo,
      merchantName: o.bidAd.merchantName,
      merchantId: o.bidAd.merchantId,
      price: o.bidAd.price,
      mznUsed: o.mznReceived,
      usdtAmount: o.usdtSold,
      monthOrders: o.bidAd.monthOrders,
      monthFinishRate: o.bidAd.monthFinishRate,
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Simulação de lucro</h1>
          <p className="text-sm text-[var(--muted)]">
            Quanto ganharias, em Meticais, se comprasses e revendesses USDT agora mesmo, para diferentes
            valores de capital. Baseado na última varredura do mercado.
          </p>
        </div>
        <RefreshButton />
      </div>

      {!snapshot ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Ainda não há nenhuma varredura registada.</p>
        </Card>
      ) : (
        <>
          <Card>
            <SimulateForm defaultCapital={chosenCapital} />
          </Card>

          <Tabs
            tabs={[
              {
                key: "detalhes",
                label: `Detalhes (${formatMzn(selected?.capital ?? 0)})`,
                content: selected ? (
                  <Card>
                    <div className="mb-4 flex items-center justify-between">
                      <CardTitle>Detalhe para {formatMzn(selected.capital)}</CardTitle>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <CardLabel>USDT comprado</CardLabel>
                        <div className="tabular">{formatUsdt(selected.trip.buy.outputAmount)}</div>
                      </div>
                      <div>
                        <CardLabel>Preço médio compra</CardLabel>
                        <div className="tabular">{formatMzn(selected.trip.buy.vwapPrice)}</div>
                      </div>
                      <div>
                        <CardLabel>Preço médio venda</CardLabel>
                        <div className="tabular">{formatMzn(selected.trip.sell.vwapPrice)}</div>
                      </div>
                      <div>
                        <CardLabel>Recebes no total</CardLabel>
                        <div className="tabular font-semibold">{formatMzn(selected.trip.sell.outputAmount)}</div>
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-1 gap-3 rounded-md bg-[var(--surface-2)] p-3 sm:grid-cols-3">
                      <div>
                        <CardLabel>Cenário conservador</CardLabel>
                        <div className="tabular">{formatMzn(selected.net.conservador.netMzn)}</div>
                      </div>
                      <div>
                        <CardLabel>Cenário médio</CardLabel>
                        <div className="tabular">{formatMzn(selected.net.medio.netMzn)}</div>
                      </div>
                      <div>
                        <CardLabel>Cenário optimista</CardLabel>
                        <div className="tabular">{formatMzn(selected.net.otimista.netMzn)}</div>
                      </div>
                    </div>

                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Como executar
                    </p>
                    <ExecutionPlan
                      buySteps={selected.trip.buy.steps}
                      sellSteps={selected.trip.sell.steps}
                      netMzn={selected.net.medio.netMzn}
                    />
                  </Card>
                ) : null,
              },
              {
                key: "comerciantes",
                label: `Por comerciante (${counterpartyRows.length})`,
                content: (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-[var(--muted)]">
                      Todas as opções de venda para {formatMzn(chosenCapital)}, sem filtrar por reputação —
                      decides tu com quem negociar. Toca numa linha para ver o plano de execução completo.
                    </p>
                    <CounterpartyOptions
                      buySteps={counterparties.buy.steps}
                      rows={counterpartyRows}
                      minDisplayProfitMzn={Number(config?.minDisplayProfitMzn ?? 0)}
                    />
                  </div>
                ),
              },
              {
                key: "comparar",
                label: "Comparar capitais",
                content: <TrancheKpisChart rows={trancheRows} chosenCapital={chosenCapital} />,
              },
              {
                key: "grafico",
                label: "Gráfico preço x lucro",
                content: pricePoints.length >= 2 ? (
                  <PriceProfitChart points={pricePoints} highlightCapital={chosenCapital} />
                ) : (
                  <Card>
                    <p className="text-sm text-[var(--muted)]">
                      Ainda não há dados suficientes no livro para desenhar este gráfico.
                    </p>
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
