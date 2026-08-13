import { getLatestSnapshot, getSettings, getCapitalPosition } from "@/lib/queries";
import { costPreferencesFrom } from "@/lib/cost-prefs";
import { roundTripForCapital, roundTripLimited, netByScenario, evaluateSellCounterparties } from "@/lib/p2p/analysis";
import { findBestAdPairs, findOptimalSize } from "@/lib/p2p/optimizer";
import { evaluateMakerStrategies } from "@/lib/p2p/maker";
import { analyzePayMethodArbitrage } from "@/lib/p2p/patterns";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { RefreshButton } from "@/components/refresh-button";
import { ExecutionPlan } from "@/components/execution-plan";
import { ScenarioRange } from "@/components/scenario-range";
import { SimulateForm, type TradeMode } from "@/components/simulate-form";
import { CounterpartyOptions, type CounterpartyRow } from "@/components/counterparty-options";
import { TrancheKpisChart, type TrancheRow } from "@/components/tranche-kpis-chart";
import { PriceProfitChart, type PricePoint } from "@/components/price-profit-chart";
import { CostBreakdown } from "@/components/simulacao/result-hero";
import { StrategyCompare, type StrategyRow } from "@/components/simulacao/strategy-compare";
import { PairTable, type PairRow } from "@/components/simulacao/pair-table";
import { MakerPanel } from "@/components/simulacao/maker-panel";
import { SizeOptimizer } from "@/components/simulacao/size-optimizer";
import { PayMethodPanel } from "@/components/simulacao/paymethod-panel";
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
  const [snapshot, config, capital] = await Promise.all([
    getLatestSnapshot(),
    getSettings(),
    getCapitalPosition(),
  ]);
  const { capital: capitalParam, modo: modoParam } = await searchParams;

  const askAds: Ad[] = snapshot?.askAds ?? [];
  const bidAds: Ad[] = snapshot?.bidAds ?? [];

  // Preferências de custo do utilizador (M-Pesa/e-Mola). Sem isto o lucro
  // mostrado ignorava por completo o que custa mover Meticais.
  const costPrefs = costPreferencesFrom(config);

  // O capital preso em operações à espera de comprador já não está em
  // Meticais — simular com ele produzia planos impossíveis de executar.
  const chosenCapital = Number(capitalParam) || Math.round(capital.availableMzn) || 5000;
  // Por omissão "equilibrado-1": comprar e vender a um só comerciante de
  // cada vez, sem espalhar por várias contrapartes.
  const mode: TradeMode = VALID_MODES.includes(modoParam as TradeMode) ? (modoParam as TradeMode) : "equilibrado-1";

  const tranches = Array.from(new Set([...STANDARD_TRANCHES, chosenCapital])).sort((a, b) => a - b);

  const rows = tranches.map((c) => {
    const trip = roundTripForCapital(askAds, bidAds, c);
    const net = netByScenario(trip, costPrefs);
    return { capital: c, trip, net };
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
  const selected = { capital: chosenCapital, trip: selectedTrip, net: netByScenario(selectedTrip, costPrefs) };
  const noSellCounterparty = selectedTrip.buy.outputAmount > 0 && selectedTrip.sell.steps.length === 0;

  // --- Motores adicionais de lucro ---------------------------------------
  const greedyTrip = roundTripForCapital(askAds, bidAds, chosenCapital);
  const greedyNet = netByScenario(greedyTrip, costPrefs);
  const pairs = findBestAdPairs(askAds, bidAds, chosenCapital, costPrefs, 25);
  const bestPair = pairs[0] ?? null;
  const optimal = findOptimalSize(askAds, bidAds, chosenCapital, chosenCapital, costPrefs);
  const maker = evaluateMakerStrategies(askAds, bidAds, chosenCapital, costPrefs);
  const payMethods = analyzePayMethodArbitrage(askAds, bidAds);

  const strategyRows: StrategyRow[] = [
    {
      key: "gulosa",
      label: "Aceitar anúncios, melhor preço primeiro",
      description: "O modo clássico: gasta o valor começando pelo anúncio mais barato e descendo a lista.",
      netMzn: greedyNet.medio.netMzn,
      netPct: greedyNet.medio.netPct,
      capitalUsedMzn: greedyTrip.buy.inputUsed,
      nOrders: greedyTrip.nOrders,
      available: greedyTrip.buy.inputUsed > 0 && greedyNet.medio.netMzn > 0,
      unavailableReason:
        greedyTrip.buy.inputUsed <= 0
          ? "Nenhum anúncio aceita este valor agora."
          : "Depois das taxas não sobra lucro por este caminho.",
      risk: "executa já",
      riskTone: "good",
    },
    {
      key: "par-unico",
      label: "Um comerciante de cada lado",
      description:
        "O melhor par comprador/vendedor — metade das taxas fixas e execução muito mais rápida.",
      netMzn: bestPair?.netMzn ?? 0,
      netPct: bestPair?.netPct ?? 0,
      capitalUsedMzn: bestPair?.spendMzn ?? 0,
      nOrders: 2,
      available: bestPair !== null,
      unavailableReason: "Nenhuma combinação de dois anúncios dá lucro depois das taxas neste momento.",
      risk: "executa já",
      riskTone: "good",
    },
    {
      key: "tamanho-optimo",
      label: "Ajustar o tamanho da operação",
      description: "Mesmo caminho, mas com o valor que rende mais — às vezes operar menos rende mais.",
      netMzn: optimal.bestAbsolute?.netMzn ?? 0,
      netPct: optimal.bestAbsolute?.netPct ?? 0,
      capitalUsedMzn: optimal.bestAbsolute?.capitalMzn ?? 0,
      nOrders: optimal.bestAbsolute?.nOrders ?? 0,
      available: (optimal.bestAbsolute?.netMzn ?? 0) > 0,
      unavailableReason: "Nenhum tamanho de operação dá lucro com o livro de agora.",
      risk: "executa já",
      riskTone: "good",
    },
    ...(maker.best
      ? [
          {
            key: maker.best.key,
            label: `Anúncio próprio — ${maker.best.label.toLowerCase()}`,
            description:
              "Em vez de aceitar anúncios, publicas os teus dentro do spread e ficas com a diferença.",
            netMzn: maker.best.netMzn,
            netPct: maker.best.netPct,
            capitalUsedMzn: maker.best.capitalUsedMzn,
            nOrders: maker.best.legsWaiting === 2 ? 0 : 1,
            available: true,
            risk: maker.best.fillRisk === "baixo" ? "executa já" : "precisa de esperar",
            riskTone: (maker.best.fillRisk === "alto" ? "critical" : "warning") as "critical" | "warning",
          } satisfies StrategyRow,
        ]
      : []),
  ];

  const availableStrategies = strategyRows.filter((s) => s.available);
  const bestStrategy =
    availableStrategies.length > 0
      ? availableStrategies.reduce((b, s) => (s.netMzn > b.netMzn ? s : b), availableStrategies[0])
      : null;

  const trancheRows: TrancheRow[] = rows.map(({ capital: c, trip, net }) => ({
    capital: c,
    netMzn: net.medio.netMzn,
    netPct: net.medio.netPct,
    nOrders: trip.nOrders,
    fullyFilled: trip.buy.fullyFilled && trip.residualUsdt < 0.0001,
  }));

  const pricePoints: PricePoint[] = rows
    .filter((r) => r.trip.buy.vwapPrice !== null && r.trip.buy.fullyFilled)
    .map(({ capital: c, trip, net }) => ({
      capital: c,
      buyPrice: trip.buy.vwapPrice as number,
      netMzn: net.medio.netMzn,
    }));

  const counterparties = evaluateSellCounterparties(askAds, bidAds, chosenCapital, costPrefs);
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

  const pairRows: PairRow[] = pairs.map((p, i) => ({
    id: `${p.buyAd.advNo}-${p.sellAd.advNo}-${i}`,
    buyMerchant: p.buyAd.merchantName,
    buyPrice: p.buyAd.price,
    sellMerchant: p.sellAd.merchantName,
    sellPrice: p.sellAd.price,
    spendMzn: p.spendMzn,
    receiveMzn: p.receiveMzn,
    usdtAmount: p.usdtAmount,
    netMzn: p.netMzn,
    netPct: p.netPct,
    spreadPct: p.spreadPct,
    worstFinishRate: p.worstFinishRate,
    worstMonthOrders: p.worstMonthOrders,
    buyStep: {
      advNo: p.buyAd.advNo,
      merchantName: p.buyAd.merchantName,
      merchantId: p.buyAd.merchantId,
      price: p.buyAd.price,
      mznUsed: p.spendMzn,
      usdtAmount: p.usdtAmount,
      monthOrders: p.buyAd.monthOrders,
      monthFinishRate: p.buyAd.monthFinishRate,
      minMzn: p.buyAd.minMzn,
      maxMzn: maxMznExecutable(p.buyAd),
    },
    sellStep: {
      advNo: p.sellAd.advNo,
      merchantName: p.sellAd.merchantName,
      merchantId: p.sellAd.merchantId,
      price: p.sellAd.price,
      mznUsed: p.receiveMzn,
      usdtAmount: p.usdtAmount,
      monthOrders: p.sellAd.monthOrders,
      monthFinishRate: p.sellAd.monthFinishRate,
      minMzn: p.sellAd.minMzn,
      maxMzn: maxMznExecutable(p.sellAd),
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Simulação de lucro</h1>
          <p className="text-sm text-[var(--muted)]">
            Quanto ganharias, em Meticais, se comprasses e revendesses USDT agora mesmo, para diferentes
            valores de capital. Baseado na última varredura do mercado, já com as taxas da Binance e o custo
            de mover dinheiro descontados.
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
            {capital.lockedMzn > 0 ? (
              <p className="mt-4 rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]">
                Tens {formatMzn(capital.lockedMzn)} presos em {capital.lockedOperations}{" "}
                {capital.lockedOperations === 1 ? "operação" : "operações"} à espera de comprador. Livre para
                operar agora: <b className="tabular">{formatMzn(capital.availableMzn)}</b>.
              </p>
            ) : null}
          </Card>

          {bestStrategy && bestStrategy.netMzn > selected.net.medio.netMzn + 0.5 ? (
            <p className="rounded-md bg-[var(--good-bg)] px-3 py-2 text-sm text-[var(--good)]">
              <b>Há uma forma melhor de fazer isto agora:</b> {bestStrategy.label} rende{" "}
              <b className="tabular">{formatMzn(bestStrategy.netMzn)}</b> — mais{" "}
              {formatMzn(bestStrategy.netMzn - selected.net.medio.netMzn)} do que o modo escolhido. Ver o
              separador &ldquo;Estratégias&rdquo;.
            </p>
          ) : null}

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

                    {selected.trip.residualStuck ? (
                      <p className="mb-4 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical)]">
                        Sobram {formatUsdt(selected.trip.residualUsdt)} que ninguém está a comprar no livro
                        neste momento. Esse USDT vale zero nesta conta — não foi contado como lucro.
                      </p>
                    ) : null}

                    {noSellCounterparty ? (
                      <p className="mb-4 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical)]">
                        Compraste {formatUsdt(selected.trip.buy.outputAmount)} mas não há comprador disponível
                        agora para levar esse USDT de volta ({mode === "capital" ? "nem no livro todo" : "dentro do limite de comerciantes deste modo"}). Espera que apareça um anúncio de compra melhor, ou considera anunciar tu mesmo a vender no Binance P2P (ver &ldquo;Anúncio próprio&rdquo;).
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
                      <CostBreakdown
                        grossProfitMzn={selected.trip.grossProfitMzn}
                        netMzn={selected.net.medio.netMzn}
                        costs={selected.net.medio.costs}
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
                key: "estrategias",
                label: "Estratégias",
                content: (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-[var(--muted)]">
                      Todas as formas de operar com este valor, calculadas com os mesmos custos. A app só
                      conhecia a primeira — as outras são novas.
                    </p>
                    <StrategyCompare rows={strategyRows} bestKey={bestStrategy?.key ?? null} />
                  </div>
                ),
              },
              {
                key: "pares",
                label: `Melhores pares (${pairRows.length})`,
                content: <PairTable rows={pairRows} />,
              },
              {
                key: "maker",
                label: "Anúncio próprio",
                content: <MakerPanel analysis={maker} />,
              },
              {
                key: "tamanho",
                label: "Tamanho óptimo",
                content: <SizeOptimizer optimal={optimal} configuredMzn={chosenCapital} />,
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
                key: "pagamento",
                label: "Métodos de pagamento",
                content: <PayMethodPanel arbitrage={payMethods} />,
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
