import { desc, eq, gte, and, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { settings, snapshots, opportunities, alerts } from "@/db/schema";
import { sendPush, sendSms } from "@/lib/messaging-client";
import { fetchAllAds } from "@/lib/p2p/binance-client";
import { normalizeAll } from "@/lib/p2p/orderbook";
import { evaluateOpportunity } from "@/lib/p2p/analysis";
import { fetchUsdMznReference } from "@/lib/p2p/reference-price";
import { buildOpportunityMessage } from "@/lib/p2p/notify-format";

export type ScanResult = {
  skipped?: string;
  snapshotId: string;
  opportunityId: string;
  isCrossed: boolean;
  meetsEntryRules: boolean;
  reasonsBlocked: string[];
  netPctMedium: number;
  alertSent: boolean;
};

/**
 * Uma varredura completa do mercado USDT/MZN: busca o livro real, grava
 * snapshot, avalia a estratégia de captura de spread cruzado contra o
 * capital configurado e, se cumprir todas as regras de entrada e não
 * estiver em cooldown, dispara o alerta push.
 *
 * Chamada por dois sítios: /api/cron/scan (scheduler externo, autenticado
 * por CRON_SECRET) e a acção de "actualizar agora" no painel (autenticada
 * pela sessão do utilizador) — ver lib/actions/scan.ts. Mesma lógica, duas
 * portas de entrada com autenticações diferentes.
 */
export async function runMarketScan(): Promise<ScanResult> {
  const [config] = await db.select().from(settings).where(eq(settings.id, true)).limit(1);
  if (!config) {
    throw new Error("settings não inicializado");
  }
  if (!config.scanningEnabled) {
    return {
      skipped: "scanning_enabled=false",
      snapshotId: "",
      opportunityId: "",
      isCrossed: false,
      meetsEntryRules: false,
      reasonsBlocked: [],
      netPctMedium: 0,
      alertSent: false,
    };
  }

  const [askRaw, bidRaw, reference] = await Promise.all([
    fetchAllAds("USDT", "MZN", "BUY"), // quem VENDE USDT
    fetchAllAds("USDT", "MZN", "SELL"), // quem COMPRA USDT
    fetchUsdMznReference().catch(() => null),
  ]);

  const askAds = normalizeAll(askRaw);
  const bidAds = normalizeAll(bidRaw);
  const capitalMzn = Number(config.currentCapitalMzn);

  const evaluation = evaluateOpportunity(askAds, bidAds, capitalMzn, {
    minGrossSpreadPct: Number(config.minGrossSpreadPct),
    minCounterpartyFinishRate: Number(config.minCounterpartyFinishRate),
    minCounterpartyMonthlyOrders: config.minCounterpartyMonthlyOrders,
    maxOrdersPerLeg: config.maxOrdersPerLeg,
    minNetPctAlert: Number(config.minNetPctAlert),
  });
  const { summary, trip, net } = evaluation;

  const [snapshot] = await db
    .insert(snapshots)
    .values({
      bestAsk: summary.bestAsk?.toFixed(4),
      bestBid: summary.bestBid?.toFixed(4),
      midPrice: summary.midPrice?.toFixed(4),
      spreadPct: summary.spreadPct?.toFixed(4),
      isCrossed: summary.isCrossed,
      nAdsAsk: summary.nAdsAsk,
      nAdsBid: summary.nAdsBid,
      liquidityAskUsdt: summary.liquidityAskUsdt.toFixed(4),
      liquidityBidUsdt: summary.liquidityBidUsdt.toFixed(4),
      referenceUsdMzn: reference?.usdMzn?.toFixed(4),
      askAds: askAds.slice(0, 200),
      bidAds: bidAds.slice(0, 200),
    })
    .returning();

  const [opportunity] = await db
    .insert(opportunities)
    .values({
      snapshotId: snapshot.id,
      capitalMzn: capitalMzn.toFixed(2),
      buyVwap: trip.buy.vwapPrice?.toFixed(4),
      sellVwap: trip.sell.vwapPrice?.toFixed(4),
      usdtAmount: trip.buy.outputAmount.toFixed(8),
      grossProfitMzn: trip.grossProfitMzn.toFixed(2),
      grossPct: trip.grossPct.toFixed(4),
      nOrders: trip.nOrders,
      residualUsdt: trip.residualUsdt.toFixed(8),
      netProfitConservativeMzn: net.conservador.netMzn.toFixed(2),
      netProfitMediumMzn: net.medio.netMzn.toFixed(2),
      netProfitOptimisticMzn: net.otimista.netMzn.toFixed(2),
      netPctConservative: net.conservador.netPct.toFixed(4),
      netPctMedium: net.medio.netPct.toFixed(4),
      netPctOptimistic: net.otimista.netPct.toFixed(4),
      meetsEntryRules: evaluation.meetsEntryRules,
      reasonsBlocked: evaluation.reasonsBlocked,
      status: "detected",
      detail: {
        buySteps: trip.buy.steps,
        sellSteps: trip.sell.steps,
      },
    })
    .returning();

  // Notifica sempre que houver QUALQUER lucro líquido positivo com capital
  // real envolvido — não só quando cumpre todas as regras de segurança
  // (reputação da contraparte, spread mínimo, etc.). As regras continuam a
  // classificar a oportunidade como "segura" ou não, mas essa classificação
  // já não decide sozinha se avisa: quem decide é o utilizador, por isso o
  // aviso deixa isso bem claro no corpo da mensagem.
  const isProfitable = trip.buy.inputUsed > 0 && net.medio.netMzn > 0;

  let alertSent = false;
  if (isProfitable) {
    const cooldownSince = new Date(Date.now() - config.alertCooldownMinutes * 60_000);
    const [recentAlert] = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(and(gte(alerts.sentAt, cooldownSince), isNotNull(alerts.opportunityId)))
      .orderBy(desc(alerts.sentAt))
      .limit(1);

    if (!recentAlert) {
      const { title, fullBody, shortBody } = buildOpportunityMessage({
        capitalMzn,
        trip,
        net,
        meetsEntryRules: evaluation.meetsEntryRules,
        reasonsBlocked: evaluation.reasonsBlocked,
      });

      const pushResult = await sendPush(title, shortBody);

      let smsError: string | null = null;
      if (config.smsAlertsEnabled && config.alertPhoneE164) {
        const smsResult = await sendSms(config.alertPhoneE164, `${title}\n\n${shortBody}`);
        smsError = smsResult.ok ? null : smsResult.error;
      }

      // O corpo guardado (e mostrado no sino dentro da app) é a simulação
      // completa, sem o limite de 500/1000 caracteres do push/SMS.
      await db.insert(alerts).values({
        opportunityId: opportunity.id,
        title,
        body: fullBody,
        gatewayMessageId: pushResult.ok ? pushResult.id : null,
        deliveryError: pushResult.ok ? smsError : `push: ${pushResult.error}${smsError ? `; sms: ${smsError}` : ""}`,
      });
      await db.update(opportunities).set({ status: "alerted" }).where(eq(opportunities.id, opportunity.id));
      alertSent = pushResult.ok;
    }
  }

  return {
    snapshotId: snapshot.id,
    opportunityId: opportunity.id,
    isCrossed: summary.isCrossed,
    meetsEntryRules: evaluation.meetsEntryRules,
    reasonsBlocked: evaluation.reasonsBlocked,
    netPctMedium: net.medio.netPct,
    alertSent,
  };
}
