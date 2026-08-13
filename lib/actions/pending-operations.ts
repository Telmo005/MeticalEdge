"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pendingOperations, settings, capitalLedger, trades, opportunities } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type StartOperationInput = {
  opportunityId?: string | null;
  capitalUsedMzn: number;
  buyPrice: number;
  usdtAmount: number;
  targetSellPrice?: number | null;
  notes?: string | null;
};

/** Regista só a perna de compra — a venda fica "em espera" até seres tu a
 *  dizer que já vendeste (finalizeOperationAction) ou o sistema encontrar
 *  sozinho um comprador ao preço-alvo (ver lib/p2p/scan.ts). Não mexe no
 *  capital configurado: só muda quando a operação for finalizada. */
export async function startOperationAction(input: StartOperationInput) {
  await requireUser();

  const [op] = await db
    .insert(pendingOperations)
    .values({
      opportunityId: input.opportunityId ?? null,
      capitalUsedMzn: input.capitalUsedMzn.toFixed(2),
      buyPrice: input.buyPrice.toFixed(4),
      usdtAmount: input.usdtAmount.toFixed(8),
      targetSellPrice: input.targetSellPrice?.toFixed(4),
      notes: input.notes ?? null,
    })
    .returning();

  if (input.opportunityId) {
    await db.update(opportunities).set({ status: "traded" }).where(eq(opportunities.id, input.opportunityId));
  }

  revalidatePath("/");
  revalidatePath("/operacoes");
  return op;
}

function numOrNull(formData: FormData, key: string): number | null {
  const v = formData.get(key);
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function startOperationFormAction(formData: FormData) {
  const capitalUsedMzn = numOrNull(formData, "capitalUsedMzn");
  const buyPrice = numOrNull(formData, "buyPrice");

  // Validação no servidor, não só no formulário: sem isto era possível
  // gravar uma operação com capital 0 e preço 0 (o formulário antigo
  // aceitava-o em silêncio), e ficava para sempre no histórico a estragar
  // a taxa de sucesso e o lucro médio.
  if (capitalUsedMzn === null || capitalUsedMzn <= 0) {
    throw new Error("O valor gasto na compra tem de ser maior do que zero.");
  }
  if (buyPrice === null || buyPrice <= 0) {
    throw new Error("O preço de compra tem de ser maior do que zero.");
  }

  // A quantidade de USDT deriva sempre dos outros dois valores. Se vier do
  // formulário e não bater certo, manda a conta — três valores livres que
  // se contradizem é como o histórico se corrompia antes.
  const derivedUsdt = capitalUsedMzn / buyPrice;
  const submittedUsdt = numOrNull(formData, "usdtAmount");
  const usdtAmount =
    submittedUsdt !== null && Math.abs(submittedUsdt - derivedUsdt) / derivedUsdt < 0.02
      ? submittedUsdt
      : derivedUsdt;

  const targetSellPrice = numOrNull(formData, "targetSellPrice");
  if (targetSellPrice !== null && targetSellPrice <= 0) {
    throw new Error("O preço-alvo de venda, se preenchido, tem de ser maior do que zero.");
  }

  await startOperationAction({
    opportunityId: (formData.get("opportunityId") as string) || null,
    capitalUsedMzn,
    buyPrice,
    usdtAmount,
    targetSellPrice,
    notes: (formData.get("notes") as string) || null,
  });

  redirect("/operacoes");
}

export type FinalizeOperationInput = {
  id: string;
  sellPrice: number;
  mznReceivedGross: number;
  feesPaidMzn: number;
  netProfitMzn?: number | null;
  notes?: string | null;
};

/** Fecha uma operação em espera: grava a perna de venda, cria a linha
 *  correspondente em `trades` (histórico, mesma lógica de
 *  lib/actions/trades.ts) e só agora faz o capital evoluir. */
export async function finalizeOperationAction(input: FinalizeOperationInput) {
  await requireUser();

  return db.transaction(async (tx) => {
    const [op] = await tx.select().from(pendingOperations).where(eq(pendingOperations.id, input.id)).limit(1);
    if (!op) throw new Error("Operação não encontrada");
    if (op.status !== "aguardando_venda") throw new Error("Esta operação já foi concluída ou cancelada");

    const grossProfitMzn = input.mznReceivedGross - Number(op.capitalUsedMzn);
    const netProfitMzn = input.netProfitMzn ?? grossProfitMzn - input.feesPaidMzn;

    const [trade] = await tx
      .insert(trades)
      .values({
        opportunityId: op.opportunityId,
        capitalUsedMzn: op.capitalUsedMzn,
        buyPrice: op.buyPrice,
        sellPrice: input.sellPrice.toFixed(4),
        usdtAmount: op.usdtAmount,
        grossProfitMzn: grossProfitMzn.toFixed(2),
        feesPaidMzn: input.feesPaidMzn.toFixed(2),
        netProfitMzn: netProfitMzn.toFixed(2),
        outcome: netProfitMzn >= 0 ? "success" : "loss",
        notes: input.notes ?? op.notes ?? null,
        executedAt: op.startedAt,
      })
      .returning();

    await tx
      .update(pendingOperations)
      .set({
        status: "concluida",
        sellPrice: input.sellPrice.toFixed(4),
        mznReceivedGross: input.mznReceivedGross.toFixed(2),
        feesPaidMzn: input.feesPaidMzn.toFixed(2),
        netProfitMzn: netProfitMzn.toFixed(2),
        finalizedAt: new Date(),
        tradeId: trade.id,
      })
      .where(eq(pendingOperations.id, input.id));

    const [config] = await tx.select().from(settings).where(eq(settings.id, true)).limit(1);
    const newBalance = Number(config.currentCapitalMzn) + netProfitMzn;

    await tx
      .update(settings)
      .set({ currentCapitalMzn: newBalance.toFixed(2), updatedAt: new Date() })
      .where(eq(settings.id, true));

    await tx.insert(capitalLedger).values({
      deltaMzn: netProfitMzn.toFixed(2),
      reason: "trade",
      tradeId: trade.id,
      resultingBalanceMzn: newBalance.toFixed(2),
    });

    revalidatePath("/");
    revalidatePath("/operacoes");
    revalidatePath("/trades");
    return trade;
  });
}

export async function finalizeOperationFormAction(formData: FormData) {
  const id = String(formData.get("id"));
  const sellPrice = numOrNull(formData, "sellPrice");
  const mznReceivedGross = numOrNull(formData, "mznReceivedGross");
  const feesPaidMzn = numOrNull(formData, "feesPaidMzn") ?? 0;
  const netProfitMzn = numOrNull(formData, "netProfitMzn");

  if (sellPrice === null || sellPrice <= 0) {
    throw new Error("O preço de venda tem de ser maior do que zero.");
  }
  if (mznReceivedGross === null || mznReceivedGross <= 0) {
    throw new Error("O valor recebido tem de ser maior do que zero.");
  }
  if (feesPaidMzn < 0) {
    throw new Error("As taxas pagas não podem ser negativas.");
  }

  await finalizeOperationAction({
    id,
    sellPrice,
    mznReceivedGross,
    feesPaidMzn,
    netProfitMzn,
    notes: (formData.get("notes") as string) || null,
  });

  redirect("/operacoes");
}

/** Desiste de uma operação em espera sem a contar como negócio — não mexe
 *  no capital (nunca chegou a sair da configuração), só arquiva. */
export async function cancelOperationFormAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id"));

  await db
    .update(pendingOperations)
    .set({ status: "cancelada", finalizedAt: new Date() })
    .where(eq(pendingOperations.id, id));

  revalidatePath("/operacoes");
}
