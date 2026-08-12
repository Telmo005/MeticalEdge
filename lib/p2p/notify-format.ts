import type { FillStep } from "@/lib/p2p/orderbook";
import type { RoundTrip, NetScenario } from "@/lib/p2p/analysis";
import type { CostScenario } from "@/lib/p2p/fees";

function formatStep(s: FillStep, i: number): string {
  return `${i + 1}. ${s.merchantName} — ${s.usdtAmount.toFixed(4)} USDT a ${s.price.toFixed(2)} MZN/USDT (${s.mznUsed.toFixed(0)} MZN)`;
}

function summarizeSteps(steps: FillStep[]): string {
  if (steps.length === 0) return "—";
  if (steps.length === 1) return `${steps[0].merchantName} (${steps[0].usdtAmount.toFixed(2)} USDT a ${steps[0].price.toFixed(2)})`;
  return `${steps[0].merchantName} e mais ${steps.length - 1}`;
}

/**
 * Constrói duas versões da mesma oportunidade: `fullBody` (simulação
 * completa — todos os passos de compra/venda, os 3 cenários de taxa, sem
 * limite de tamanho) para o registo em alerts e o sino dentro da app, e
 * `shortBody` (cabe no limite de 500/1000 caracteres do gateway de
 * mensagens) para push/SMS.
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

  const fullLines = [
    `Capital: ${capitalMzn.toFixed(0)} MZN`,
    "",
    "COMPRA (nesta ordem):",
    ...trip.buy.steps.map(formatStep),
    "",
    "VENDA (nesta ordem):",
    ...trip.sell.steps.map(formatStep),
    "",
    `Lucro bruto: ${trip.grossProfitMzn.toFixed(2)} MZN (${trip.grossPct.toFixed(3)}%)`,
    `Líquido conservador: ${net.conservador.netMzn.toFixed(2)} MZN (${net.conservador.netPct.toFixed(3)}%)`,
    `Líquido médio: ${net.medio.netMzn.toFixed(2)} MZN (${net.medio.netPct.toFixed(3)}%)`,
    `Líquido optimista: ${net.otimista.netMzn.toFixed(2)} MZN (${net.otimista.netPct.toFixed(3)}%)`,
    `Ordens necessárias: ${trip.nOrders}`,
  ];
  if (!meetsEntryRules) {
    fullLines.push("", "⚠ Avisos:", ...reasonsBlocked.map((r) => `- ${r}`));
  }
  const fullBody = fullLines.join("\n");

  const warning = meetsEntryRules ? "" : ` ⚠ com avisos: ${reasonsBlocked[0]}${reasonsBlocked.length > 1 ? "…" : ""}.`;
  const shortBody =
    `Compra: ${summarizeSteps(trip.buy.steps)}. Venda: ${summarizeSteps(trip.sell.steps)}. ` +
    `Capital ${capitalMzn.toFixed(0)} MZN -> líquido ~${net.medio.netMzn.toFixed(0)} MZN (${net.medio.netPct.toFixed(2)}%), ` +
    `${trip.nOrders} ordens.${warning} Abre a app para o plano completo.`;

  return { title, fullBody, shortBody };
}
