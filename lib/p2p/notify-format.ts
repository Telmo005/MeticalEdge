import type { FillStep } from "@/lib/p2p/orderbook";
import type { RoundTrip, NetScenario } from "@/lib/p2p/analysis";
import type { CostScenario } from "@/lib/p2p/fees";

const PUSH_MAX_STEPS_PER_LEG = 4;

function formatStepLine(s: FillStep): string {
  return `- ${s.merchantName}: ${s.usdtAmount.toFixed(2)} USDT a ${s.price.toFixed(2)} MZN/USDT`;
}

/** Lista real (não resumida a "e mais N") — corta só se realmente não
 *  couber no limite do canal, e mesmo assim diz quantas ficaram de fora em
 *  vez de simplesmente cortar a meio. */
function formatStepsBlock(steps: FillStep[], maxLines = PUSH_MAX_STEPS_PER_LEG): string {
  if (steps.length === 0) return "—";
  const shown = steps.slice(0, maxLines).map(formatStepLine);
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
export function buildOpportunityMessage({
  capitalMzn,
  trip,
  net,
  meetsEntryRules,
  reasonsBlocked,
}: {
  capitalMzn: number;
  trip: RoundTrip;
  net: Record<CostScenario["label"], NetScenario>;
  meetsEntryRules: boolean;
  reasonsBlocked: string[];
}): { title: string; fullBody: string; shortBody: string } {
  const title = meetsEntryRules ? "Oportunidade segura de lucro" : "Oportunidade de lucro (com avisos)";

  const spentMzn = trip.buy.inputUsed;
  const receivedGrossMzn = trip.sell.outputAmount;
  const finalTotalMzn = spentMzn + net.medio.netMzn;
  const resultLabel = net.medio.netMzn >= 0 ? "lucro" : "prejuízo";

  const fullLines = [
    `Capital: ${capitalMzn.toFixed(0)} MZN`,
    "",
    `COMPRA (${trip.buy.steps.length} ${trip.buy.steps.length === 1 ? "ordem" : "ordens"}):`,
    ...trip.buy.steps.map((s) => formatStepLine(s)),
    "",
    `VENDA (${trip.sell.steps.length} ${trip.sell.steps.length === 1 ? "ordem" : "ordens"}):`,
    ...trip.sell.steps.map((s) => formatStepLine(s)),
    "",
    `Gastas ${spentMzn.toFixed(2)} MZN → recebes ${receivedGrossMzn.toFixed(2)} MZN (bruto)`,
    `Ficas no total com: ${finalTotalMzn.toFixed(2)} MZN`,
    `Resultado (médio): ${net.medio.netMzn >= 0 ? "+" : ""}${net.medio.netMzn.toFixed(2)} MZN de ${resultLabel} (${net.medio.netPct.toFixed(3)}%)`,
    "",
    `Cenário conservador: ${net.conservador.netMzn.toFixed(2)} MZN (${net.conservador.netPct.toFixed(3)}%)`,
    `Cenário médio: ${net.medio.netMzn.toFixed(2)} MZN (${net.medio.netPct.toFixed(3)}%)`,
    `Cenário optimista: ${net.otimista.netMzn.toFixed(2)} MZN (${net.otimista.netPct.toFixed(3)}%)`,
  ];
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
  ];
  if (!meetsEntryRules) {
    shortLines.push("", `⚠ Aviso: ${reasonsBlocked[0]}${reasonsBlocked.length > 1 ? ` (+${reasonsBlocked.length - 1})` : ""}`);
  }
  const shortBody = shortLines.join("\n");

  return { title, fullBody, shortBody };
}
