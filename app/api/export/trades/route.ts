import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getRecentTrades } from "@/lib/queries";

const COLUMNS = [
  "startedAt", "completedAt", "pair", "buyExchange", "sellExchange",
  "buyPrice", "sellPrice", "quantity", "capitalUsdt",
  "buyFeeUsdt", "sellFeeUsdt", "slippageEstimatedPct", "slippageRealPct",
  "profitTheoreticalUsdt", "profitEstimatedUsdt", "profitRealUsdt",
  "outcome", "executionTimeMs", "errorMessage",
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Exporta o histórico de operações (reais por omissão, `?paper=1` para
 *  simuladas) em CSV — contabilidade/fiscal, como qualquer plataforma
 *  profissional oferece. */
export async function GET(request: NextRequest) {
  await requireUser();

  const isPaper = request.nextUrl.searchParams.get("paper") === "1";
  const trades = await getRecentTrades(5000, isPaper);

  const lines = [
    COLUMNS.join(","),
    ...trades.map((t) => COLUMNS.map((col) => csvEscape(t[col as keyof typeof t])).join(",")),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="operacoes${isPaper ? "-simuladas" : ""}.csv"`,
    },
  });
}
