import { desc, eq, gte, and, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { settings, snapshots, opportunities, alerts } from "@/db/schema";
import { sendPush, sendSms } from "@/lib/messaging-client";
import { fetchAllAds } from "@/lib/p2p/binance-client";
import { normalizeAll } from "@/lib/p2p/orderbook";
import { evaluateOpportunity } from "@/lib/p2p/analysis";
import { fetchUsdMznReference } from "@/lib/p2p/reference-price";
import { buildOpportunityMessage } from "@/lib/p2p/notify-format";
import { getPriceExtremes, getReferenceDivergenceSignal } from "@/lib/p2p/price-intelligence";
import { analyzeTopAdLifecycle } from "@/lib/p2p/ad-lifecycle";

const PRICE_SIGNAL_WINDOW_DAYS = 7;
const PRICE_SIGNAL_MIN_SAMPLES = 30;
const PRICE_SIGNAL_EPSILON = 0.01;

const NEW_AD_MIN_IMPROVEMENT_PCT = 0.1;

const REFERENCE_DIVERGENCE_WINDOW_DAYS = 7;
const REFERENCE_DIVERGENCE_MIN_SAMPLES = 180;
const REFERENCE_DIVERGENCE_Z_THRESHOLD = 1.5;

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

  // Ordenados por preço (melhor primeiro) antes de gravar — assim o
  // primeiro elemento do array guardado é sempre o topo do livro daquele
  // lado, o que os motores de inteligência (anúncio parado / anúncio novo)
  // em lib/p2p/ad-lifecycle.ts dependem para ler o histórico de forma
  // barata (só o elemento [0] de cada snapshot passado).
  const sortedAskAds = [...askAds].sort((a, b) => a.price - b.price);
  const sortedBidAds = [...bidAds].sort((a, b) => b.price - a.price);

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
      askAds: sortedAskAds.slice(0, 200),
      bidAds: sortedBidAds.slice(0, 200),
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
  //
  // Adicionalmente (sem substituir a regra acima): também notifica sempre
  // que o lucro BRUTO ultrapassa o limiar em MZN que o utilizador definiu em
  // Configurações ("Lucro mínimo a considerar") — mesmo em cenários onde o
  // líquido médio ainda não é positivo, para não deixar passar despercebida
  // uma oportunidade grande na origem só porque as taxas a apertam.
  const hasCapital = trip.buy.inputUsed > 0;
  const netPositive = hasCapital && net.medio.netMzn > 0;
  const grossAboveThreshold = hasCapital && trip.grossProfitMzn > Number(config.minDisplayProfitMzn);
  const isProfitable = netPositive || grossAboveThreshold;

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

  // --- Inteligência de preços: mínimo/máximo recente ---------------------
  // Compara o preço desta varredura com o histórico já guardado (uma
  // varredura por minuto, graças ao cron) para avisar quando o mercado está
  // no melhor ponto visto nos últimos dias para comprar ou vender — sem
  // exigir que ninguém leia gráfico nenhum. Independente do alerta de
  // oportunidade acima: um é "há lucro na viagem completa agora", este é
  // "este lado do mercado está num ponto historicamente bom".
  async function sendGuardedAlert(title: string, body: string) {
    const cooldownSince = new Date(Date.now() - config.alertCooldownMinutes * 60_000);
    const [recent] = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(and(eq(alerts.title, title), gte(alerts.sentAt, cooldownSince)))
      .orderBy(desc(alerts.sentAt))
      .limit(1);
    if (recent) return;

    const pushResult = await sendPush(title, body);
    let smsError: string | null = null;
    if (config.smsAlertsEnabled && config.alertPhoneE164) {
      const smsResult = await sendSms(config.alertPhoneE164, `${title}\n\n${body}`);
      smsError = smsResult.ok ? null : smsResult.error;
    }
    await db.insert(alerts).values({
      opportunityId: opportunity.id,
      title,
      body,
      gatewayMessageId: pushResult.ok ? pushResult.id : null,
      deliveryError: pushResult.ok ? smsError : `push: ${pushResult.error}${smsError ? `; sms: ${smsError}` : ""}`,
    });
  }

  const extremes = await getPriceExtremes(PRICE_SIGNAL_WINDOW_DAYS);
  const hasEnoughHistory = extremes.sampleCount >= PRICE_SIGNAL_MIN_SAMPLES;

  if (
    hasEnoughHistory &&
    summary.bestAsk !== null &&
    extremes.minAsk !== null &&
    summary.bestAsk <= extremes.minAsk + PRICE_SIGNAL_EPSILON
  ) {
    await sendGuardedAlert(
      "Preço de compra no mínimo recente — bom momento para comprar",
      `Comprar USDT agora: ${summary.bestAsk.toFixed(2)} MZN\n\n` +
        `É o preço mais baixo dos últimos ${PRICE_SIGNAL_WINDOW_DAYS} dias. Pode valer a pena aproveitar agora.`
    );
  }

  if (
    hasEnoughHistory &&
    summary.bestBid !== null &&
    extremes.maxBid !== null &&
    summary.bestBid >= extremes.maxBid - PRICE_SIGNAL_EPSILON
  ) {
    await sendGuardedAlert(
      "Preço de venda no máximo recente — bom momento para vender",
      `Vender USDT agora: ${summary.bestBid.toFixed(2)} MZN\n\n` +
        `É o preço mais alto dos últimos ${PRICE_SIGNAL_WINDOW_DAYS} dias. Pode valer a pena vender agora se tiveres USDT disponível.`
    );
  }

  // --- Ciclo de vida do topo do livro: anúncio novo / anúncio parado -----
  // "new": o melhor preço mudou de anúncio agora mesmo e melhorou de forma
  // não-trivial — tende a durar pouco, vale a pena avisar com urgência.
  // "stale": o mesmo anúncio está em primeiro lugar há muitos minutos
  // enquanto o preço de referência da Binance já se moveu — o comerciante
  // provavelmente esqueceu-se do preço, não é uma escolha deliberada dele.
  const [askLifecycle, bidLifecycle] = await Promise.all([
    analyzeTopAdLifecycle("ask"),
    analyzeTopAdLifecycle("bid"),
  ]);

  if (askLifecycle.kind === "new") {
    const improvementPct =
      askLifecycle.previousPrice !== null
        ? (Math.abs(askLifecycle.previousPrice - askLifecycle.price) / askLifecycle.previousPrice) * 100
        : 100;
    if (improvementPct >= NEW_AD_MIN_IMPROVEMENT_PCT) {
      await sendGuardedAlert(
        "Novo melhor preço de compra — pode não durar",
        `Novo preço de compra: ${askLifecycle.price.toFixed(2)} MZN\n\n` +
          `Acabou de aparecer, melhor do que o anterior (${(askLifecycle.previousPrice ?? askLifecycle.price).toFixed(2)} MZN). ` +
          `Ofertas assim costumam esgotar depressa — se queres aproveitar, é agora.`
      );
    }
  }

  if (bidLifecycle.kind === "new") {
    const improvementPct =
      bidLifecycle.previousPrice !== null
        ? (Math.abs(bidLifecycle.previousPrice - bidLifecycle.price) / bidLifecycle.previousPrice) * 100
        : 100;
    if (improvementPct >= NEW_AD_MIN_IMPROVEMENT_PCT) {
      await sendGuardedAlert(
        "Novo melhor preço de venda — pode não durar",
        `Novo preço de venda: ${bidLifecycle.price.toFixed(2)} MZN\n\n` +
          `Acabou de aparecer, melhor do que o anterior (${(bidLifecycle.previousPrice ?? bidLifecycle.price).toFixed(2)} MZN). ` +
          `Ofertas assim costumam esgotar depressa — se tens USDT disponível, é agora.`
      );
    }
  }

  if (askLifecycle.kind === "stale") {
    await sendGuardedAlert(
      "Anúncio de compra parado — pode estar desactualizado",
      `Melhor preço de compra: ${askLifecycle.price.toFixed(2)} MZN\n\n` +
        `Está sem mudar há ${askLifecycle.streakMinutes} minutos, mas o preço de referência da Binance já se ` +
        `moveu ${askLifecycle.referenceMovePct.toFixed(2)}% nesse tempo. O comerciante pode ter-se esquecido do anúncio.`
    );
  }

  if (bidLifecycle.kind === "stale") {
    await sendGuardedAlert(
      "Anúncio de venda parado — pode estar desactualizado",
      `Melhor preço de venda: ${bidLifecycle.price.toFixed(2)} MZN\n\n` +
        `Está sem mudar há ${bidLifecycle.streakMinutes} minutos, mas o preço de referência da Binance já se ` +
        `moveu ${bidLifecycle.referenceMovePct.toFixed(2)}% nesse tempo. O comerciante pode ter-se esquecido do anúncio.`
    );
  }

  // --- Divergência incomum vs. preço de referência -----------------------
  const divergence = await getReferenceDivergenceSignal(
    summary.bestAsk,
    summary.bestBid,
    reference?.usdMzn ?? null,
    REFERENCE_DIVERGENCE_WINDOW_DAYS
  );

  if (
    divergence.sampleCount >= REFERENCE_DIVERGENCE_MIN_SAMPLES &&
    divergence.askPremiumZScore !== null &&
    Math.abs(divergence.askPremiumZScore) >= REFERENCE_DIVERGENCE_Z_THRESHOLD &&
    divergence.currentAskPremiumPct !== null
  ) {
    await sendGuardedAlert(
      "Desvio incomum no preço de compra vs. referência",
      `Preço de compra: ${summary.bestAsk?.toFixed(2) ?? "—"} MZN\n\n` +
        `Está ${Math.abs(divergence.currentAskPremiumPct).toFixed(2)}% ` +
        `${divergence.currentAskPremiumPct >= 0 ? "acima" : "abaixo"} do preço de referência da Binance — isto é ` +
        `incomum comparado com os últimos ${REFERENCE_DIVERGENCE_WINDOW_DAYS} dias deste mercado, vale a pena olhar com atenção.`
    );
  }

  if (
    divergence.sampleCount >= REFERENCE_DIVERGENCE_MIN_SAMPLES &&
    divergence.bidDiscountZScore !== null &&
    Math.abs(divergence.bidDiscountZScore) >= REFERENCE_DIVERGENCE_Z_THRESHOLD &&
    divergence.currentBidDiscountPct !== null
  ) {
    await sendGuardedAlert(
      "Desvio incomum no preço de venda vs. referência",
      `Preço de venda: ${summary.bestBid?.toFixed(2) ?? "—"} MZN\n\n` +
        `Está ${Math.abs(divergence.currentBidDiscountPct).toFixed(2)}% ` +
        `${divergence.currentBidDiscountPct >= 0 ? "abaixo" : "acima"} do preço de referência da Binance — isto é ` +
        `incomum comparado com os últimos ${REFERENCE_DIVERGENCE_WINDOW_DAYS} dias deste mercado, vale a pena olhar com atenção.`
    );
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
