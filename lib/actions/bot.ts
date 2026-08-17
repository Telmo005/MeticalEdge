"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { botSettings, capitalLedger, alerts, exchangeBalances, paperBalances, trades, tradeEvents, type ExchangeId } from "@/db/schema";
import { EXCHANGE_IDS, otherExchange } from "@/lib/exchange/registry";
import { requireUser } from "@/lib/auth";
import { sendPush } from "@/lib/messaging-client";

/** Onboarding (secção 1): define os dois saldos iniciais de uma só vez —
 *  Exchange A (Binance) com USDT para comprar, Exchange B (Bybit) com o
 *  valor em USDT do activo já lá reservado para vender. `initialBalanceUsdt`
 *  (base do ROI, secção 25) só é definido nesta chamada, uma única vez. */
export async function setBothExchangeBalancesFormAction(formData: FormData) {
  await requireUser();
  const binanceUsdt = Number(formData.get("binanceUsdt"));
  const bybitUsdt = Number(formData.get("bybitUsdt"));
  if (!Number.isFinite(binanceUsdt) || binanceUsdt < 0 || !Number.isFinite(bybitUsdt) || bybitUsdt < 0) {
    throw new Error("Os saldos têm de ser zero ou mais.");
  }

  const changedAt = new Date();
  await db.transaction(async (tx) => {
    await tx.update(exchangeBalances).set({ usdtFree: binanceUsdt.toFixed(8), totalValueUsdt: binanceUsdt.toFixed(8), updatedAt: changedAt }).where(eq(exchangeBalances.exchangeId, "binance"));
    await tx.update(exchangeBalances).set({ usdtFree: bybitUsdt.toFixed(8), totalValueUsdt: bybitUsdt.toFixed(8), updatedAt: changedAt }).where(eq(exchangeBalances.exchangeId, "bybit"));
    await tx.update(botSettings).set({ initialBalanceUsdt: (binanceUsdt + bybitUsdt).toFixed(8), updatedAt: changedAt }).where(eq(botSettings.id, true));

    await tx.insert(capitalLedger).values([
      { changedAt, exchangeId: "binance", deltaUsdt: binanceUsdt.toFixed(8), reason: "saldo_inicial", resultingBalanceUsdt: binanceUsdt.toFixed(8) },
      { changedAt, exchangeId: "bybit", deltaUsdt: bybitUsdt.toFixed(8), reason: "saldo_inicial", resultingBalanceUsdt: bybitUsdt.toFixed(8) },
    ]);
  });

  revalidatePath("/", "layout");
}

/** Correcção manual do saldo de uma exchange (depois do onboarding) — ex.
 *  depois de um depósito/levantamento fora do ciclo normal do robô. Nunca
 *  mexe em `initialBalanceUsdt`, que fica fixo desde o onboarding. */
export async function setExchangeBalanceAction(exchangeId: ExchangeId, newValueUsdt: number, reason = "ajuste_manual") {
  await requireUser();
  if (!Number.isFinite(newValueUsdt) || newValueUsdt < 0) {
    throw new Error("O saldo tem de ser zero ou mais.");
  }

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(exchangeBalances).where(eq(exchangeBalances.exchangeId, exchangeId)).limit(1);
    const [other] = await tx.select().from(exchangeBalances).where(eq(exchangeBalances.exchangeId, otherExchange(exchangeId))).limit(1);

    await tx
      .update(exchangeBalances)
      .set({ usdtFree: newValueUsdt.toFixed(8), totalValueUsdt: newValueUsdt.toFixed(8), updatedAt: new Date() })
      .where(eq(exchangeBalances.exchangeId, exchangeId));

    const changedAt = new Date();
    await tx.insert(capitalLedger).values([
      { changedAt, exchangeId, deltaUsdt: (newValueUsdt - Number(current.totalValueUsdt)).toFixed(8), reason, resultingBalanceUsdt: newValueUsdt.toFixed(8) },
      { changedAt, exchangeId: otherExchange(exchangeId), deltaUsdt: "0", reason: `${reason}_referencia`, resultingBalanceUsdt: other.totalValueUsdt },
    ]);
  });

  revalidatePath("/", "layout");
}

export async function setExchangeBalanceFormAction(formData: FormData) {
  const exchangeId = String(formData.get("exchangeId")) as ExchangeId;
  const value = Number(formData.get("valueUsdt"));
  if (!EXCHANGE_IDS.includes(exchangeId) || !Number.isFinite(value) || value < 0) return;
  await setExchangeBalanceAction(exchangeId, value);
}

/** Botão "PARAR BOT" (secção 30) — o worker verifica killSwitchEngaged a
 *  cada iteração do loop (poucos segundos), por isso isto pára novas
 *  operações quase de imediato, mesmo sem falar directamente com o
 *  processo do worker. */
export async function engageKillSwitchAction() {
  await requireUser();
  await db
    .update(botSettings)
    .set({ killSwitchEngaged: true, killSwitchReason: "parado manualmente pelo utilizador", updatedAt: new Date() })
    .where(eq(botSettings.id, true));

  await db.insert(alerts).values({
    kind: "bot_parado",
    title: "Bot parado manualmente",
    body: "O bot foi parado a partir do painel. Nenhuma nova operação será iniciada até seres tu a retomar.",
  });
  await sendPush("Bot parado", "Parado manualmente a partir do painel.");

  revalidatePath("/", "layout");
}

export async function resumeBotAction() {
  await requireUser();
  await db
    .update(botSettings)
    .set({ killSwitchEngaged: false, killSwitchReason: null, updatedAt: new Date() })
    .where(eq(botSettings.id, true));

  await db.insert(alerts).values({
    kind: "bot_parado",
    title: "Bot retomado",
    body: "Varredura e execução retomadas a partir do painel.",
  });

  revalidatePath("/", "layout");
}

/** Interruptor explícito paper/live (checklist de go-live: nunca "live"
 *  por acidente). O formulário no painel exige confirmação ao mudar para
 *  "live" (`SubmitButton confirmMessage`). */
export async function setModeAction(mode: "paper" | "live") {
  await requireUser();
  await db.update(botSettings).set({ mode, updatedAt: new Date() }).where(eq(botSettings.id, true));

  await db.insert(alerts).values({
    kind: "bot_parado",
    title: mode === "live" ? "Modo LIVE activado" : "Modo Paper (simulação) activado",
    body: mode === "live"
      ? "O robô pode agora enviar ordens reais quando encontrar uma oportunidade válida."
      : "O robô volta a simular — nenhuma ordem real será enviada.",
  });
  await sendPush(mode === "live" ? "Modo LIVE activado" : "Modo Paper activado", "Alterado a partir do painel.");

  revalidatePath("/", "layout");
}

export async function setModeFormAction(formData: FormData) {
  const mode = String(formData.get("mode"));
  if (mode !== "paper" && mode !== "live") return;
  await setModeAction(mode);
}

/** Repõe o capital simulado a 10/10 USDT e apaga o histórico de trades
 *  simulados — útil para recomeçar um teste de paper trading do zero. */
export async function resetPaperBalancesAction() {
  await requireUser();

  await db.transaction(async (tx) => {
    await tx.update(paperBalances).set({ usdtFree: "10", totalValueUsdt: "10", updatedAt: new Date() }).where(eq(paperBalances.exchangeId, "binance"));
    await tx.update(paperBalances).set({ usdtFree: "10", totalValueUsdt: "10", updatedAt: new Date() }).where(eq(paperBalances.exchangeId, "bybit"));
    await tx.delete(capitalLedger).where(eq(capitalLedger.isPaper, true));

    const paperTrades = await tx.select({ id: trades.id }).from(trades).where(eq(trades.isPaper, true));
    if (paperTrades.length > 0) {
      await tx.delete(tradeEvents).where(inArray(tradeEvents.tradeId, paperTrades.map((t) => t.id)));
      await tx.delete(trades).where(eq(trades.isPaper, true));
    }
  });

  revalidatePath("/", "layout");
}

export type BotSettingsInput = {
  tradeSizePct: number;
  maxTradeUsdt: number;
  minProfitPct: number;
  minSafetyMarginPct: number;
  maxExecutionTimeMs: number;
  dailyLossLimitUsdt: number;
  maxTradeLossUsdt: number;
  maxConsecutiveErrors: number;
  maxConsecutiveLosses: number;
  watchedPairs: string[];
  scanningEnabled: boolean;
};

export async function updateBotSettingsAction(input: BotSettingsInput) {
  await requireUser();

  await db
    .update(botSettings)
    .set({
      tradeSizePct: input.tradeSizePct.toFixed(2),
      maxTradeUsdt: input.maxTradeUsdt.toFixed(8),
      minProfitPct: input.minProfitPct.toFixed(3),
      minSafetyMarginPct: input.minSafetyMarginPct.toFixed(3),
      maxExecutionTimeMs: input.maxExecutionTimeMs,
      dailyLossLimitUsdt: input.dailyLossLimitUsdt.toFixed(8),
      maxTradeLossUsdt: input.maxTradeLossUsdt.toFixed(8),
      maxConsecutiveErrors: input.maxConsecutiveErrors,
      maxConsecutiveLosses: input.maxConsecutiveLosses,
      watchedPairs: input.watchedPairs,
      scanningEnabled: input.scanningEnabled,
      updatedAt: new Date(),
    })
    .where(eq(botSettings.id, true));

  revalidatePath("/settings");
}

export async function updateBotSettingsFormAction(formData: FormData) {
  const watchedPairsRaw = String(formData.get("watchedPairs") ?? "");
  const watchedPairs = watchedPairsRaw
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);

  await updateBotSettingsAction({
    tradeSizePct: Number(formData.get("tradeSizePct")),
    maxTradeUsdt: Number(formData.get("maxTradeUsdt")),
    minProfitPct: Number(formData.get("minProfitPct")),
    minSafetyMarginPct: Number(formData.get("minSafetyMarginPct")),
    maxExecutionTimeMs: Number(formData.get("maxExecutionTimeMs")),
    dailyLossLimitUsdt: Number(formData.get("dailyLossLimitUsdt")),
    maxTradeLossUsdt: Number(formData.get("maxTradeLossUsdt")),
    maxConsecutiveErrors: Number(formData.get("maxConsecutiveErrors")),
    maxConsecutiveLosses: Number(formData.get("maxConsecutiveLosses")),
    watchedPairs: watchedPairs.length > 0 ? watchedPairs : ["BTCUSDT", "ETHUSDT"],
    scanningEnabled: formData.get("scanningEnabled") === "on",
  });
}
