import type { FillStep } from "@/lib/p2p/orderbook";
import type { RoundTrip, NetByScenario } from "@/lib/p2p/analysis";
import { reputationLabel } from "@/lib/reputation";

const PUSH_MAX_STEPS_PER_LEG = 4;

/** Versão completa (fullBody, sem limite de tamanho) — inclui os números
 *  da reputação, não só a palavra. */
function formatStepLineFull(s: FillStep): string {
  const label = reputationLabel(s.monthFinishRate, s.monthOrders);
  return (
    `- ${s.merchantName}: ${s.usdtAmount.toFixed(2)} USDT a ${s.price.toFixed(2)} MZN/USDT ` +
    `(${label} — ${s.monthOrders ?? "?"} ordens/mês, ${((s.monthFinishRate ?? 0) * 100).toFixed(0)}% conclusão)`
  );
}

/** Versão compacta (shortBody, dentro do limite do gateway) — só a palavra,
 *  não os números: "fiável"/"moderado"/"arriscado" já diz o que importa sem
 *  ninguém ter de interpretar uma percentagem sozinha. */
function formatStepLineShort(s: FillStep): string {
  const label = reputationLabel(s.monthFinishRate, s.monthOrders);
  return `- ${s.merchantName}: ${s.usdtAmount.toFixed(2)} USDT a ${s.price.toFixed(2)} MZN/USDT (${label})`;
}

/** Lista real (não resumida a "e mais N") — corta só se realmente não
 *  couber no limite do canal, e mesmo assim diz quantas ficaram de fora em
 *  vez de simplesmente cortar a meio. */
function formatStepsBlock(steps: FillStep[], maxLines = PUSH_MAX_STEPS_PER_LEG): string {
  if (steps.length === 0) return "—";
  const shown = steps.slice(0, maxLines).map(formatStepLineShort);
  const rest = steps.length - shown.length;
  if (rest > 0) shown.push(`(+ ${rest} ${rest === 1 ? "ordem" : "ordens"}, ver na app)`);
  return shown.join("\n");
}

/**
 * Constrói duas versões da mesma oportunidade: `fullBody` (simulação
 * completa — todos os passos de compra/venda, os 3 cenários de taxa, sem
 * limite de tamanho) para o registo em alerts e o sino dentro da app, e
 * `shortBody` (cabe no limite de 500/1000 caracteres do gateway de
 * mensagens) para push/SMS. Ambos em formato de várias linhas, tipo email —
 * nunca tudo espremido numa única frase — e ambos mostram sempre o valor
 * final ("ficas com X MZN"), não só a variação de lucro/prejuízo.
 */
export type BetterPairSummary = {
  buyMerchant: string;
  buyPrice: number;
  sellMerchant: string;
  sellPrice: number;
  spendMzn: number;
  netMzn: number;
};

export function buildOpportunityMessage({
  capitalMzn,
  trip,
  net,
  meetsEntryRules,
  reasonsBlocked,
  betterPair = null,
  bestNetMzn,
  thresholdMzn = 0,
}: {
  capitalMzn: number;
  trip: RoundTrip;
  net: NetByScenario;
  meetsEntryRules: boolean;
  reasonsBlocked: string[];
  /** Alternativa de uma ordem por perna que rende mais do que o caminho
   *  guloso descrito acima — quando existe, é ela que deve ser executada. */
  betterPair?: BetterPairSummary | null;
  /** Lucro líquido da MELHOR forma de executar, seja ela qual for. É este o
   *  número que decidiu enviar o aviso, por isso é este que vai no título —
   *  antes o título dizia só "oportunidade" e obrigava a abrir para saber
   *  se valia dois Meticais ou duzentos. */
  bestNetMzn?: number;
  /** Limiar configurado em /settings, para o corpo poder explicar porque é
   *  que este aviso passou. */
  thresholdMzn?: number;
}): { title: string; fullBody: string; shortBody: string } {
  const headline = bestNetMzn ?? net.medio.netMzn;
  const title = meetsEntryRules
    ? `Lucro de ${headline.toFixed(0)} MZN — dentro das regras`
    : `Lucro de ${headline.toFixed(0)} MZN — com avisos`;

  const spentMzn = trip.buy.inputUsed;
  const receivedGrossMzn = trip.sell.outputAmount;
  const finalTotalMzn = spentMzn + net.medio.netMzn;
  const resultLabel = net.medio.netMzn >= 0 ? "lucro" : "prejuízo";

  // Nem sempre o capital configurado cabe todo nos anúncios disponíveis
  // (limites mínimos por anúncio) — quando sobra capital por usar, dizemos
  // isso explicitamente logo a seguir ao capital, para "Capital: 1000 MZN"
  // e "Gastas 821 MZN" mais abaixo não parecerem um erro de conta.
  const unusedMzn = capitalMzn - spentMzn;
  const hasUnusedCapital = unusedMzn > 1;
  const capitalNote = hasUnusedCapital
    ? `Só ${spentMzn.toFixed(2)} MZN coube nos anúncios disponíveis agora — sobram ${unusedMzn.toFixed(2)} MZN por usar.`
    : null;

  const fullLines = [
    `Capital disponível: ${capitalMzn.toFixed(0)} MZN`,
    capitalNote,
    "",
    `COMPRA (${trip.buy.steps.length} ${trip.buy.steps.length === 1 ? "ordem" : "ordens"}):`,
    ...trip.buy.steps.map((s) => formatStepLineFull(s)),
    "",
    `VENDA (${trip.sell.steps.length} ${trip.sell.steps.length === 1 ? "ordem" : "ordens"}):`,
    ...trip.sell.steps.map((s) => formatStepLineFull(s)),
    "",
    `Gastas ${spentMzn.toFixed(2)} MZN → recebes ${receivedGrossMzn.toFixed(2)} MZN (bruto)`,
    `Ficas no total com: ${finalTotalMzn.toFixed(2)} MZN`,
    `Resultado (médio): ${net.medio.netMzn >= 0 ? "+" : ""}${net.medio.netMzn.toFixed(2)} MZN de ${resultLabel} (${net.medio.netPct.toFixed(3)}%)`,
    "",
    `Cenário conservador: ${net.conservador.netMzn.toFixed(2)} MZN (${net.conservador.netPct.toFixed(3)}%)`,
    `Cenário médio: ${net.medio.netMzn.toFixed(2)} MZN (${net.medio.netPct.toFixed(3)}%)`,
    `Cenário optimista: ${net.otimista.netMzn.toFixed(2)} MZN (${net.otimista.netPct.toFixed(3)}%)`,
    "",
    "CUSTOS (cenário médio):",
    `- Taxas Binance: ${net.medio.costs.takerFeeMzn.toFixed(2)} MZN`,
    net.medio.costs.railSendFeeMzn > 0
      ? `- Transferências de dinheiro: ${net.medio.costs.railSendFeeMzn.toFixed(2)} MZN`
      : null,
    net.medio.costs.railWithdrawFeeMzn > 0
      ? `- Levantamento: ${net.medio.costs.railWithdrawFeeMzn.toFixed(2)} MZN`
      : null,
    `- Total: ${net.medio.costs.totalMzn.toFixed(2)} MZN`,
    "",
    thresholdMzn > 0
      ? `Avisado porque o lucro líquido passa o teu limiar de ${thresholdMzn.toFixed(2)} MZN.`
      : "Avisado porque sobra dinheiro depois de todos os custos.",
  ].filter((line): line is string => line !== null);

  if (betterPair) {
    fullLines.push(
      "",
      "MELHOR ALTERNATIVA — uma ordem de cada lado:",
      `Compra ${betterPair.spendMzn.toFixed(2)} MZN a ${betterPair.buyMerchant} (${betterPair.buyPrice.toFixed(2)} MZN/USDT)`,
      `Vende a ${betterPair.sellMerchant} (${betterPair.sellPrice.toFixed(2)} MZN/USDT)`,
      `Lucro: ${betterPair.netMzn.toFixed(2)} MZN — mais do que o plano acima, com metade das ordens.`
    );
  }
  if (!meetsEntryRules) {
    fullLines.push("", "⚠ Avisos:", ...reasonsBlocked.map((r) => `- ${r}`));
  }
  const fullBody = fullLines.join("\n");

  const shortLines = [
    `COMPRA (${trip.buy.steps.length} ${trip.buy.steps.length === 1 ? "ordem" : "ordens"}):`,
    formatStepsBlock(trip.buy.steps),
    "",
    `VENDA (${trip.sell.steps.length} ${trip.sell.steps.length === 1 ? "ordem" : "ordens"}):`,
    formatStepsBlock(trip.sell.steps),
    "",
    `Gastas ${spentMzn.toFixed(0)} MZN → Ficas com ${finalTotalMzn.toFixed(0)} MZN`,
    `Resultado: ${net.medio.netMzn >= 0 ? "+" : ""}${net.medio.netMzn.toFixed(0)} MZN de ${resultLabel} (${net.medio.netPct.toFixed(2)}%)`,
    hasUnusedCapital ? `(de ${capitalMzn.toFixed(0)} MZN disponíveis, só ${spentMzn.toFixed(0)} coube nos anúncios)` : null,
    betterPair
      ? `\nMELHOR: ${betterPair.buyMerchant} -> ${betterPair.sellMerchant}, ${betterPair.spendMzn.toFixed(0)} MZN, +${betterPair.netMzn.toFixed(0)} MZN em 2 ordens.`
      : null,
  ].filter((line): line is string => line !== null);
  if (!meetsEntryRules) {
    shortLines.push("", `⚠ Aviso: ${reasonsBlocked[0]}${reasonsBlocked.length > 1 ? ` (+${reasonsBlocked.length - 1})` : ""}`);
  }
  const shortBody = shortLines.join("\n");

  return { title, fullBody, shortBody };
}
