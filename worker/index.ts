import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { alerts, botHeartbeats, exchangeBalances, opportunities, paperBalances, workerLock, type AssetBalanceDetail, type ExchangeId } from "@/db/schema";
import type { ExchangeInfo } from "@/lib/exchange/types";
import { EXCHANGES, EXCHANGE_IDS } from "@/lib/exchange/registry";
import { withHealthTracking } from "@/lib/exchange/health";
import { scanForOpportunities, type ExchangeInventory } from "@/lib/arbitrage/scanner";
import { checkRebalanceRecommended, hasTooManyConsecutiveErrors, isWithinDailyLossLimit } from "@/lib/arbitrage/safety";
import { executeArbitrage, reconcilePendingTrades } from "@/lib/execution/executor";
import { simulateArbitrage } from "@/lib/execution/paper-executor";
import { engageKillSwitch } from "@/lib/kill-switch.core";
import { getBotSettings, getTodayNetProfitUsdt } from "@/lib/queries.core";
import { logError } from "@/lib/errorLog.core";
import { sendPush } from "@/lib/messaging-client";

const LOOP_INTERVAL_MS = 5_000;
const EXCHANGE_INFO_TTL_MS = 10 * 60 * 1000;
const FEE_CACHE_TTL_MS = 5 * 60 * 1000;
const TOP_N_OPPORTUNITIES = 10;
/** Inventário "infinito" usado como aproximação em modo paper — o gate real
 *  de inventário acontece dentro de `simulateArbitrage`, com preços frescos
 *  do livro de ordens; isto só evita bloquear a varredura sem dados reais
 *  de carteira simulada por activo. */
const PAPER_ASSET_SENTINEL = 1e12;
/** Uma instância inactiva há mais do que isto perde a lease automaticamente
 *  (roteiro P0 — lock distribuído). Bem acima do intervalo do loop para uma
 *  instância viva nunca a perder por atraso transitório. */
const LOCK_STALE_MS = 30_000;
/** Divergência de saldo acima disto entre dois ciclos dispara alerta em vez
 *  de corrigir em silêncio — limiar conservador para não soar por cada
 *  drift normal de taxas/arredondamento. */
const BALANCE_DIVERGENCE_MIN_USDT = 2;
const BALANCE_DIVERGENCE_MIN_PCT = 15;

const WORKER_ID = randomUUID();

let consecutiveErrors = 0;
const exchangeInfoCache: Partial<Record<ExchangeId, { info: ExchangeInfo; expiresAt: number }>> = {};
const feeCache: Partial<Record<ExchangeId, { pct: number; expiresAt: number }>> = {};

function baseAssetOf(pair: string): string {
  return pair.endsWith("USDT") ? pair.slice(0, -4) : pair;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lock por lease (roteiro P0): impede duas instâncias do worker a correr
 *  ao mesmo tempo contra a mesma base de dados. Não usa
 *  `pg_advisory_lock` — `DATABASE_URL` aponta ao transaction pooler do
 *  Supabase, onde a sessão não fica garantidamente presa à mesma ligação
 *  entre queries, o que tornaria um lock consultivo por sessão pouco
 *  fiável. Uma lease com heartbeat funciona sobre qualquer modo de
 *  pooling e recupera sozinha se este processo morrer (`kill -9`
 *  incluído): a lease expira ao fim de `LOCK_STALE_MS` sem refresco. */
async function claimWorkerLock(): Promise<boolean> {
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS);
  const [claimed] = await db
    .update(workerLock)
    .set({ holderId: WORKER_ID, heartbeatAt: new Date() })
    .where(and(eq(workerLock.id, true), or(isNull(workerLock.holderId), lt(workerLock.heartbeatAt, staleBefore))))
    .returning({ id: workerLock.id });
  return Boolean(claimed);
}

async function refreshWorkerLock(): Promise<boolean> {
  const [refreshed] = await db
    .update(workerLock)
    .set({ heartbeatAt: new Date() })
    .where(and(eq(workerLock.id, true), eq(workerLock.holderId, WORKER_ID)))
    .returning({ id: workerLock.id });
  return Boolean(refreshed);
}

async function getCachedExchangeInfo(exchangeId: ExchangeId): Promise<ExchangeInfo> {
  const cached = exchangeInfoCache[exchangeId];
  if (cached && cached.expiresAt > Date.now()) return cached.info;
  const info = await withHealthTracking(exchangeId, () => EXCHANGES[exchangeId].getExchangeInfo());
  exchangeInfoCache[exchangeId] = { info, expiresAt: Date.now() + EXCHANGE_INFO_TTL_MS };
  return info;
}

async function getCachedFeePct(exchangeId: ExchangeId, referenceSymbol: string, fallbackPct: number): Promise<number> {
  const cached = feeCache[exchangeId];
  if (cached && cached.expiresAt > Date.now()) return cached.pct;
  if (!EXCHANGES[exchangeId].hasCredentials()) return fallbackPct;
  try {
    const { takerFeePct } = await withHealthTracking(exchangeId, () => EXCHANGES[exchangeId].getCommissionRates(referenceSymbol));
    feeCache[exchangeId] = { pct: takerFeePct, expiresAt: Date.now() + FEE_CACHE_TTL_MS };
    return takerFeePct;
  } catch {
    return fallbackPct;
  }
}

async function writeHeartbeat(fields: Partial<typeof botHeartbeats.$inferInsert>) {
  await db
    .update(botHeartbeats)
    .set({ ...fields, at: new Date(), updatedAt: new Date() })
    .where(eq(botHeartbeats.id, true));
}

/** Alerta (nunca corrige em silêncio) se o saldo total de uma exchange
 *  divergir de forma abrupta entre dois ciclos — reconciliação de saldo,
 *  roteiro P0. Uma diferença normal de taxas/arredondamento fica sempre
 *  abaixo do limiar; algo maior é um sinal genuíno a investigar (depósito/
 *  levantamento inesperado, dessincronização, ou pior). */
async function checkBalanceDivergence(exchangeId: ExchangeId, previousTotalUsdt: number, newTotalUsdt: number) {
  const deltaUsdt = Math.abs(newTotalUsdt - previousTotalUsdt);
  const deltaPct = previousTotalUsdt > 0 ? (deltaUsdt / previousTotalUsdt) * 100 : 0;
  if (deltaUsdt < BALANCE_DIVERGENCE_MIN_USDT || deltaPct < BALANCE_DIVERGENCE_MIN_PCT) return;

  const message = `Saldo em ${exchangeId} mudou de ${previousTotalUsdt.toFixed(4)} para ${newTotalUsdt.toFixed(4)} USDT (${deltaPct.toFixed(1)}%) entre dois ciclos — confirma se foi um depósito/levantamento teu.`;
  await db.insert(alerts).values({ kind: "erro", title: `Saldo divergente em ${exchangeId}`, body: message });
  await sendPush("Saldo divergente", message);
}

/** Busca saldos ao vivo nas duas exchanges (com medição de saúde/latência),
 *  calcula um preço de referência para cada activo vigiado, e actualiza
 *  `exchange_balances` — total, USDT livre, e o detalhe por activo para o
 *  painel. Devolve o inventário para o scanner usar no dimensionamento de
 *  capital e na verificação de inventário. Modo live apenas. */
async function syncLiveBalances(pairs: string[]): Promise<Record<ExchangeId, ExchangeInventory>> {
  const baseAssets = [...new Set(pairs.map(baseAssetOf))];
  const inventory = {} as Record<ExchangeId, ExchangeInventory>;

  for (const exchangeId of EXCHANGE_IDS) {
    if (!EXCHANGES[exchangeId].hasCredentials()) {
      inventory[exchangeId] = { usdtFree: 0, assets: {} };
      continue;
    }

    const [previousRow] = await db.select().from(exchangeBalances).where(eq(exchangeBalances.exchangeId, exchangeId));

    const balances = await withHealthTracking(exchangeId, () => EXCHANGES[exchangeId].getAccountBalances());
    const usdtFree = Number(balances.find((b) => b.asset === "USDT")?.free ?? "0");
    const assets: Record<string, number> = {};
    const assetsDetail: AssetBalanceDetail[] = [{ asset: "USDT", free: usdtFree, locked: 0, valueUsdt: usdtFree }];
    let totalValueUsdt = usdtFree;

    for (const balance of balances) {
      if (balance.asset === "USDT") continue;
      const free = Number(balance.free);
      const locked = Number(balance.locked);
      const qty = free + locked;
      if (baseAssets.includes(balance.asset)) assets[balance.asset] = free;
      if (qty <= 0) continue;

      try {
        const book = await withHealthTracking(exchangeId, () => EXCHANGES[exchangeId].getOrderBookDepth(`${balance.asset}USDT`, 5));
        const bestBid = Number(book.bids[0]?.[0] ?? 0);
        const valueUsdt = qty * bestBid;
        totalValueUsdt += valueUsdt;
        assetsDetail.push({ asset: balance.asset, free, locked, valueUsdt });
      } catch {
        // sem par directo contra USDT (ou erro transitório) — activo fica de fora do valor total, mas continua visível como qty 0-valor no detalhe se for um dos vigiados.
        if (baseAssets.includes(balance.asset)) assetsDetail.push({ asset: balance.asset, free, locked, valueUsdt: 0 });
      }
    }

    if (previousRow) {
      await checkBalanceDivergence(exchangeId, Number(previousRow.totalValueUsdt), totalValueUsdt);
    }

    inventory[exchangeId] = { usdtFree, assets };
    await db
      .update(exchangeBalances)
      .set({ usdtFree: String(usdtFree), totalValueUsdt: String(totalValueUsdt), assetsDetail, updatedAt: new Date() })
      .where(eq(exchangeBalances.exchangeId, exchangeId));
  }

  return inventory;
}

/** Inventário simulado (paper trading) — lê `paper_balances` tal como
 *  está, sem chamadas às exchanges (não precisa de chaves API nenhumas).
 *  O gate real de inventário por activo acontece em `simulateArbitrage`,
 *  com preços frescos. */
async function buildPaperInventory(pairs: string[]): Promise<Record<ExchangeId, ExchangeInventory>> {
  const baseAssets = [...new Set(pairs.map(baseAssetOf))];
  const rows = await db.select().from(paperBalances);
  const inventory = {} as Record<ExchangeId, ExchangeInventory>;

  for (const exchangeId of EXCHANGE_IDS) {
    const row = rows.find((r) => r.exchangeId === exchangeId);
    const usdtFree = Number(row?.usdtFree ?? 0);
    const assets: Record<string, number> = {};
    for (const asset of baseAssets) assets[asset] = PAPER_ASSET_SENTINEL;
    inventory[exchangeId] = { usdtFree, assets };
  }

  return inventory;
}

async function tick() {
  if (!(await refreshWorkerLock())) {
    throw new Error("perdeu a lease do worker_lock — outra instância deve ter assumido; a terminar este processo");
  }

  const settings = await getBotSettings();
  const isPaper = settings.mode === "paper";

  if (settings.killSwitchEngaged) {
    await writeHeartbeat({ status: "paused", statusDetail: settings.killSwitchReason ?? "kill switch activo" });
    return;
  }

  const todayNet = await getTodayNetProfitUsdt(isPaper);
  if (!isWithinDailyLossLimit(todayNet, Number(settings.dailyLossLimitUsdt))) {
    await engageKillSwitch(`limite de perda diária atingido: ${todayNet.toFixed(4)} USDT hoje`);
    return;
  }

  if (!settings.scanningEnabled) {
    await writeHeartbeat({ status: "paused", statusDetail: "varredura desligada nas definições" });
    return;
  }

  const pairs = settings.watchedPairs;
  const inventory = isPaper ? await buildPaperInventory(pairs) : await syncLiveBalances(pairs);

  const balanceRows = isPaper ? await db.select().from(paperBalances) : await db.select().from(exchangeBalances);
  const rebalance = checkRebalanceRecommended(
    Object.fromEntries(balanceRows.map((r) => [r.exchangeId, Number(r.totalValueUsdt)])),
  );

  const referenceSymbol = pairs[0] ?? "BTCUSDT";
  const feePctByExchange = {
    binance: await getCachedFeePct("binance", referenceSymbol, Number(settings.assumedTakerFeePct)),
    bybit: await getCachedFeePct("bybit", referenceSymbol, Number(settings.assumedTakerFeePct)),
  };

  const { evaluations, best } = await scanForOpportunities({
    pairs,
    inventory,
    feePctByExchange,
    tradeSizePct: Number(settings.tradeSizePct),
    maxTradeUsdt: Number(settings.maxTradeUsdt),
    minProfitPct: Number(settings.minProfitPct),
    minSafetyMarginPct: Number(settings.minSafetyMarginPct),
  });

  const topEvaluations = evaluations.slice(0, TOP_N_OPPORTUNITIES);
  // Um único registo com dados inconsistentes nunca pode abortar o resto do
  // tick (nem impedir o heartbeat de actualizar) — cada inserção falha de
  // forma isolada e fica registada, sem derrubar as restantes.
  const insertedIds: (string | null)[] = [];
  for (const evaluation of topEvaluations) {
    try {
      const [row] = await db
        .insert(opportunities)
        .values({
          pair: evaluation.pair,
          buyExchange: evaluation.buyExchange,
          sellExchange: evaluation.sellExchange,
          buyPrice: String(evaluation.buyPrice),
          sellPrice: String(evaluation.sellPrice),
          quantity: String(evaluation.quantity),
          capitalUsdt: String(evaluation.capitalUsdt),
          grossSpreadPct: String(evaluation.grossSpreadPct),
          feesPct: String(evaluation.feesPct),
          estimatedSlippagePct: String(evaluation.estimatedSlippagePct),
          netResultUsdt: String(evaluation.netResultUsdt),
          netPct: String(evaluation.netPct),
          liquidityOk: evaluation.liquidityOk,
          passedFilters: evaluation.passedFilters,
          rejectReasons: evaluation.rejectReasons,
          status: "detected",
        })
        .returning({ id: opportunities.id });
      insertedIds.push(row.id);
    } catch (err) {
      insertedIds.push(null);
      await logError("worker.tick.insertOpportunity", err, { pair: evaluation.pair, buyExchange: evaluation.buyExchange, sellExchange: evaluation.sellExchange });
    }
  }

  const bestId = best ? insertedIds[topEvaluations.indexOf(best)] : null;

  if (best && bestId) {
    if (isPaper) {
      await simulateArbitrage({
        opportunity: best,
        opportunityId: bestId,
        buyFeePct: feePctByExchange[best.buyExchange],
        sellFeePct: feePctByExchange[best.sellExchange],
        minProfitPct: Number(settings.minProfitPct),
        minSafetyMarginPct: Number(settings.minSafetyMarginPct),
      });
    } else if (EXCHANGES.binance.hasCredentials() && EXCHANGES.bybit.hasCredentials()) {
      const exchangeInfo = {
        binance: await getCachedExchangeInfo("binance"),
        bybit: await getCachedExchangeInfo("bybit"),
      };
      await executeArbitrage({
        opportunity: best,
        opportunityId: bestId,
        buyFeePct: feePctByExchange[best.buyExchange],
        sellFeePct: feePctByExchange[best.sellExchange],
        minProfitPct: Number(settings.minProfitPct),
        minSafetyMarginPct: Number(settings.minSafetyMarginPct),
        maxExecutionTimeMs: settings.maxExecutionTimeMs,
        maxTradeLossUsdt: Number(settings.maxTradeLossUsdt),
        maxConsecutiveLosses: settings.maxConsecutiveLosses,
        exchangeInfo,
      });
    }
    // modo live sem chaves nas duas exchanges: só regista, nunca executa.
  }

  consecutiveErrors = 0;
  await writeHeartbeat({
    status: "scanning",
    statusDetail: best ? `${isPaper ? "[Paper] " : ""}melhor: ${best.pair} ${best.buyExchange}->${best.sellExchange} ${best.netPct.toFixed(3)}%` : "sem oportunidade válida",
    opportunitiesEvaluated: evaluations.length,
    bestNetPct: evaluations[0] ? String(evaluations[0].netPct) : null,
    rebalanceRecommended: rebalance.recommended,
    rebalanceReason: rebalance.reason,
  });
}

async function loop() {
  for (;;) {
    try {
      await tick();
    } catch (err) {
      consecutiveErrors += 1;
      await logError("worker.tick", err);
      const settings = await getBotSettings().catch(() => null);
      if (settings && hasTooManyConsecutiveErrors(consecutiveErrors, settings.maxConsecutiveErrors)) {
        await engageKillSwitch(`${consecutiveErrors} erros consecutivos no worker`);
      }
    }
    await sleep(LOOP_INTERVAL_MS);
  }
}

async function main() {
  const claimed = await claimWorkerLock();
  if (!claimed) {
    console.error("worker: já existe outra instância activa (worker_lock reivindicado há menos de 30s) — a sair. Nunca corras duas instâncias ao mesmo tempo.");
    process.exit(1);
  }

  const reconciled = await reconcilePendingTrades().catch(async (err) => {
    await logError("worker.reconcilePendingTrades", err);
    return 0;
  });
  if (reconciled > 0) {
    await sendPush("Trades reconciliadas", `${reconciled} operação(ões) presa(s) de um processo anterior foram fechadas com o resultado real.`);
  }

  await loop();
}

main();
