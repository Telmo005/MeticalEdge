import { getLatestSnapshot, getSettings } from "@/lib/queries";
import { roundTripForCapital, roundTripLimited, netByScenario, evaluateSellCounterparties } from "@/lib/p2p/analysis";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { RefreshButton } from "@/components/refresh-button";
import { ExecutionPlan } from "@/components/execution-plan";
import { ScenarioRange } from "@/components/scenario-range";
import { SimulateForm, type TradeMode } from "@/components/simulate-form";
import { CounterpartyOptions, type CounterpartyRow } from "@/components/counterparty-options";
import { TrancheKpisChart, type TrancheRow } from "@/components/tranche-kpis-chart";
import { PriceProfitChart, type PricePoint } from "@/components/price-profit-chart";
import { Tabs } from "@/components/ui/tabs";
import { formatMzn, formatUsdt } from "@/lib/utils";
import { maxMznExecutable, type Ad } from "@/lib/p2p/orderbook";

const STANDARD_TRANCHES = [500, 1000, 2000, 5000, 10000];
const VALID_MODES: TradeMode[] = ["capital", "equilibrado-1", "equilibrado-2", "um-para-varios"];

export default async function SimulacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ capital?: string; modo?: string }>;
}) {
  const [snapshot, config] = await Promise.all([getLatestSnapshot(), getSettings()]);
  const { capital: capitalParam, modo: modoParam } = await searchParams;

  const askAds: Ad[] = snapshot?.askAds ?? [];
  const bidAds: Ad[] = snapshot?.bidAds ?? [];

  const chosenCapital = Number(capitalParam) || Number(config?.currentCapitalMzn) || 5000;
  // Por omissão "equilibrado-1": comprar e vender a um só comerciante de
  // cada vez, sem espalhar por várias contrapartes — ver components/
  // simulate-form.tsx para as três opções e porque nenhuma delas obriga a
  // usar o capital todo se isso só servir para confundir.
  const mode: TradeMode = VALID_MODES.includes(modoParam as TradeMode) ? (modoParam as TradeMode) : "equilibrado-1";

  const tranches = Array.from(new Set([...STANDARD_TRANCHES, chosenCapital])).sort((a, b) => a - b);

  const rows = tranches.map((capital) => {
    const trip = roundTripForCapital(askAds, bidAds, capital);
    const net = netByScenario(trip);
    return { capital, trip, net };
  });

  let selectedTrip: ReturnType<typeof roundTripForCapital>;
  let unusedCapitalMzn = 0;
  if (mode === "capital") {
    selectedTrip = roundTripForCapital(askAds, bidAds, chosenCapital);
  } else {
    const limits: Record<Exclude<TradeMode, "capital">, { maxBuyAds: number | null; maxSellAds: number | null }> = {
      "equilibrado-1": { maxBuyAds: 1, maxSellAds: 1 },
      "equilibrado-2": { maxBuyAds: 2, maxSellAds: 2 },
      "um-para-varios": { maxBuyAds: 1, maxSellAds: null },
    };
    const balanced = roundTripLimited(askAds, bidAds, chosenCapital, limits[mode]);
    selectedTrip = balanced;
    unusedCapitalMzn = balanced.unusedCapitalMzn;
  }
  const selected = { capital: chosenCapital, trip: selectedTrip, net: netByScenario(selectedTrip) };
  const noSellCounterparty = selectedTrip.buy.outputAmount > 0 && selectedTrip.sell.steps.length === 0;

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
      minMzn: o.bidAd.minMzn,
      maxMzn: maxMznExecutable(o.bidAd),
    },
  }));

  return (
    <div className="flex flex-col gap-6">
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
            <SimulateForm defaultCapital={chosenCapital} mode={mode} />
          </Card>

          <Tabs
            tabs={[
              {
                key: "detalhes",
                label: `Detalhes (${formatMzn(selected.capital)})`,
                content: (
                  <Card>
                    <div className="mb-4 flex items-center justify-between">
                      <CardTitle>Detalhe para {formatMzn(selected.capital)}</CardTitle>
                    </div>

                    {mode !== "capital" && unusedCapitalMzn > 1 ? (
                      <p className="mb-4 rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]">
                        Negociaste {formatMzn(selected.trip.buy.inputUsed)} de {formatMzn(selected.capital)}{" "}
                        configurados — {formatMzn(unusedCapitalMzn)} ficam por usar nesta oportunidade (modo
                        equilibrado: só usa o que fecha em poucos comerciantes, não força o resto).
                      </p>
                    ) : null}

                    {mode === "capital" && !selected.trip.buy.fullyFilled ? (
                      <p className="mb-4 rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
                        Só {formatMzn(selected.trip.buy.inputUsed)} de {formatMzn(selected.capital)} coube nos
                        anúncios disponíveis agora — os valores abaixo (&ldquo;Gastas&rdquo;, &ldquo;Ficas
                        com&rdquo;) são sobre o que foi mesmo usado, não sobre o capital todo.
                      </p>
                    ) : null}

                    {noSellCounterparty ? (
                      <p className="mb-4 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical)]">
                        Compraste {formatUsdt(selected.trip.buy.outputAmount)} mas não há comprador disponível
                        agora para levar esse USDT de volta ({mode === "capital" ? "nem no livro todo" : "dentro do limite de comerciantes deste modo"}). Espera que apareça um anúncio de compra melhor, ou considera anunciar tu mesmo a vender no Binance P2P.
                      </p>
                    ) : null}

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

                    <div className="mb-4 rounded-md bg-[var(--surface-2)] p-4">
                      <ScenarioRange
                        conservadorMzn={selected.net.conservador.netMzn}
                        medioMzn={selected.net.medio.netMzn}
                        otimistaMzn={selected.net.otimista.netMzn}
                      />
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
                ),
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
