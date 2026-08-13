import { getOpportunityById, getLatestSnapshot, getCapitalPosition, getSettings } from "@/lib/queries";
import { startOperationFormAction } from "@/lib/actions/pending-operations";
import { costPreferencesFrom } from "@/lib/cost-prefs";
import { computeCosts, MEDIO } from "@/lib/p2p/fees";
import { Card, CardLabel } from "@/components/ui/card";
import { StartOperationForm } from "@/components/operacoes/start-operation-form";

export default async function NewOperationPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunityId?: string; capital?: string; buyPrice?: string; target?: string }>;
}) {
  const params = await searchParams;
  const [opportunity, snapshot, capital, config] = await Promise.all([
    params.opportunityId ? getOpportunityById(params.opportunityId) : Promise.resolve(null),
    getLatestSnapshot(),
    getCapitalPosition(),
    getSettings(),
  ]);

  const bestBid = snapshot?.bestBid == null ? null : Number(snapshot.bestBid);
  const bestAsk = snapshot?.bestAsk == null ? null : Number(snapshot.bestAsk);

  const numParam = (v: string | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // Os valores podem vir de três sítios, por ordem de confiança: o link, a
  // oportunidade avaliada, ou o mercado de agora. Antes só a oportunidade
  // contava, e chegar aqui pela navegação normal deixava tudo vazio.
  const defaults = {
    capitalUsedMzn:
      numParam(params.capital) ??
      (opportunity?.capitalMzn ? Number(opportunity.capitalMzn) : null) ??
      (capital.availableMzn > 0 ? capital.availableMzn : null),
    buyPrice:
      numParam(params.buyPrice) ?? (opportunity?.buyVwap ? Number(opportunity.buyVwap) : null) ?? bestAsk,
    usdtAmount: opportunity?.usdtAmount ? Number(opportunity.usdtAmount) : null,
    targetSellPrice:
      numParam(params.target) ?? (opportunity?.sellVwap ? Number(opportunity.sellVwap) : null) ?? bestBid,
  };

  // Custo aproximado de uma ordem, no cenário médio — o formulário usa isto
  // para calcular ao vivo o preço a que a operação empata.
  const prefs = costPreferencesFrom(config);
  const oneOrderCost = computeCosts(
    MEDIO,
    {
      takerOrders: 1,
      avgPriceMzn: defaults.buyPrice ?? bestAsk ?? 1,
      buyVolumeMzn: defaults.capitalUsedMzn ?? 0,
      sellVolumeMzn: 0,
      buyTransfers: 1,
    },
    prefs
  ).totalMzn;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Iniciar operação</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Usa isto quando já compraste o USDT mas ainda não vendeste — fica registado como
          &ldquo;em espera&rdquo; em <b>/operacoes</b>, e o sistema avisa-te sozinho assim que aparecer um
          comprador ao preço-alvo (ou melhor). O teu capital só muda de valor quando finalizares a venda.
        </p>
      </div>

      {opportunity ? (
        <Card>
          <CardLabel>Pré-preenchido a partir da oportunidade avaliada</CardLabel>
          <p className="text-sm text-[var(--muted)]">
            Os valores abaixo vêm da simulação — ajusta-os para o que realmente aconteceu na compra antes de
            gravar. Se gravares a simulação em vez da realidade, o histórico de lucro deixa de valer nada.
          </p>
        </Card>
      ) : null}

      <StartOperationForm
        action={startOperationFormAction}
        defaults={defaults}
        opportunityId={opportunity?.id ?? null}
        availableCapitalMzn={capital.availableMzn}
        currentBestBid={bestBid}
        estimatedFeeMznPerOrder={oneOrderCost}
      />
    </div>
  );
}
