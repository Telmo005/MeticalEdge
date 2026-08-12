"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trades, settings, capitalLedger, opportunities } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type LogTradeInput = {
  opportunityId?: string | null;
  capitalUsedMzn: number;
  buyPrice?: number | null;
  sellPrice?: number | null;
  usdtAmount?: number | null;
  grossProfitMzn?: number | null;
  feesPaidMzn: number;
  netProfitMzn: number;
  outcome: "success" | "partial" | "loss";
  notes?: string | null;
  executedAt?: string | null;
};

/**
 * Regista uma operação executada manualmente na Binance e faz o capital
 * evoluir de acordo — equivalente TypeScript ao padrão "log_trade RPC
 * transaccional" (ver comentário em supabase/migrations/0001_init.sql sobre
 * porque não precisamos de SECURITY DEFINER aqui: único escritor de
 * confiança, tudo dentro de uma transacção Drizzle).
 */
export async function logTradeAction(input: LogTradeInput) {
  await requireUser();

  return db.transaction(async (tx) => {
    const [trade] = await tx
      .insert(trades)
      .values({
        opportunityId: input.opportunityId ?? null,
        capitalUsedMzn: input.capitalUsedMzn.toFixed(2),
        buyPrice: input.buyPrice?.toFixed(4),
        sellPrice: input.sellPrice?.toFixed(4),
        usdtAmount: input.usdtAmount?.toFixed(8),
        grossProfitMzn: input.grossProfitMzn?.toFixed(2),
        feesPaidMzn: input.feesPaidMzn.toFixed(2),
        netProfitMzn: input.netProfitMzn.toFixed(2),
        outcome: input.outcome,
        notes: input.notes ?? null,
        executedAt: input.executedAt ? new Date(input.executedAt) : new Date(),
      })
      .returning();

    const [config] = await tx.select().from(settings).where(eq(settings.id, true)).limit(1);
    const newBalance = Number(config.currentCapitalMzn) + input.netProfitMzn;

    await tx
      .update(settings)
      .set({ currentCapitalMzn: newBalance.toFixed(2), updatedAt: new Date() })
      .where(eq(settings.id, true));

    await tx.insert(capitalLedger).values({
      deltaMzn: input.netProfitMzn.toFixed(2),
      reason: "trade",
      tradeId: trade.id,
      resultingBalanceMzn: newBalance.toFixed(2),
    });

    if (input.opportunityId) {
      await tx.update(opportunities).set({ status: "traded" }).where(eq(opportunities.id, input.opportunityId));
    }

    revalidatePath("/");
    revalidatePath("/trades");
    return trade;
  });
}

function numOrNull(formData: FormData, key: string): number | null {
  const v = formData.get(key);
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Wrapper directamente ligável a `<form action={...}>` — usado pela
 *  página /trades/new. Calcula lucro líquido = bruto - taxas se não vier
 *  explícito. */
export async function logTradeFormAction(formData: FormData) {
  const capitalUsedMzn = numOrNull(formData, "capitalUsedMzn") ?? 0;
  const grossProfitMzn = numOrNull(formData, "grossProfitMzn");
  const feesPaidMzn = numOrNull(formData, "feesPaidMzn") ?? 0;
  const netProfitMznInput = numOrNull(formData, "netProfitMzn");
  const netProfitMzn = netProfitMznInput ?? (grossProfitMzn ?? 0) - feesPaidMzn;

  await logTradeAction({
    opportunityId: (formData.get("opportunityId") as string) || null,
    capitalUsedMzn,
    buyPrice: numOrNull(formData, "buyPrice"),
    sellPrice: numOrNull(formData, "sellPrice"),
    usdtAmount: numOrNull(formData, "usdtAmount"),
    grossProfitMzn,
    feesPaidMzn,
    netProfitMzn,
    outcome: (formData.get("outcome") as "success" | "partial" | "loss") || "success",
    notes: (formData.get("notes") as string) || null,
    executedAt: (formData.get("executedAt") as string) || null,
  });

  redirect("/trades");
}
