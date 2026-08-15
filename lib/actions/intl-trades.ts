"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { intlTrades } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type LogIntlTradeInput = {
  pair: string;
  region: string;
  platformBuy: string;
  platformSell: string;
  buyPrice: number;
  sellPrice: number;
  capitalUsedUsd: number;
  feesPaidUsd: number;
  netProfitUsd: number;
  notes?: string | null;
  executedAt?: string | null;
};

/** Regista um ciclo de arbitragem internacional executado manualmente —
 *  ver comentário em db/schema.ts sobre porque não há ledger de capital
 *  aqui (ao contrário de lib/actions/trades.ts para o MZN). */
export async function logIntlTradeAction(input: LogIntlTradeInput) {
  await requireUser();

  const [trade] = await db
    .insert(intlTrades)
    .values({
      pair: input.pair,
      region: input.region,
      platformBuy: input.platformBuy,
      platformSell: input.platformSell,
      buyPrice: input.buyPrice.toFixed(4),
      sellPrice: input.sellPrice.toFixed(4),
      capitalUsedUsd: input.capitalUsedUsd.toFixed(2),
      feesPaidUsd: input.feesPaidUsd.toFixed(2),
      netProfitUsd: input.netProfitUsd.toFixed(2),
      notes: input.notes ?? null,
      executedAt: input.executedAt ? new Date(input.executedAt) : new Date(),
    })
    .returning();

  revalidatePath("/arbitragem-intl");
  return trade;
}

function numOrNull(formData: FormData, key: string): number | null {
  const v = formData.get(key);
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function logIntlTradeFormAction(formData: FormData) {
  const capitalUsedUsd = numOrNull(formData, "capitalUsedUsd") ?? 0;
  const buyPrice = numOrNull(formData, "buyPrice") ?? 0;
  const sellPrice = numOrNull(formData, "sellPrice") ?? 0;
  const feesPaidUsd = numOrNull(formData, "feesPaidUsd") ?? 0;
  const netProfitUsdInput = numOrNull(formData, "netProfitUsd");
  const usdt = buyPrice > 0 ? capitalUsedUsd / buyPrice : 0;
  const grossProfitUsd = usdt * sellPrice - capitalUsedUsd;
  const netProfitUsd = netProfitUsdInput ?? grossProfitUsd - feesPaidUsd;

  const [pairLabel, region] = String(formData.get("pairAndRegion") ?? "|").split("|");

  await logIntlTradeAction({
    pair: pairLabel || "?",
    region: region || "?",
    platformBuy: String(formData.get("platformBuy") ?? "binance_p2p"),
    platformSell: String(formData.get("platformSell") ?? "bybit_p2p"),
    buyPrice,
    sellPrice,
    capitalUsedUsd,
    feesPaidUsd,
    netProfitUsd,
    notes: (formData.get("notes") as string) || null,
    executedAt: (formData.get("executedAt") as string) || null,
  });
}
