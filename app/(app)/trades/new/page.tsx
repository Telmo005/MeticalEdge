import { getOpportunityById, getLatestSnapshot } from "@/lib/queries";
import { logTradeFormAction } from "@/lib/actions/trades";
import { Card, CardLabel } from "@/components/ui/card";
import { LogTradeForm } from "@/components/trades/log-trade-form";

export default async function NewTradePage({
  searchParams,
}: {
  searchParams: Promise<{ opportunityId?: string }>;
}) {
  const { opportunityId } = await searchParams;
  const [opportunity, snapshot] = await Promise.all([
    opportunityId ? getOpportunityById(opportunityId) : Promise.resolve(null),
    getLatestSnapshot(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Registar operação</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Para operações em que já compraste E já vendeste. Se ainda estás à espera de comprador, usa antes
          &ldquo;Iniciar operação&rdquo; — assim o sistema vigia o preço por ti e o capital só muda quando a
          venda acontecer.
        </p>
      </div>

      {opportunity ? (
        <Card>
          <CardLabel>Pré-preenchido a partir da oportunidade avaliada</CardLabel>
          <p className="text-sm text-[var(--muted)]">
            Os valores abaixo vêm da simulação — ajusta-os para o que realmente aconteceu na Binance antes de
            gravar.
          </p>
        </Card>
      ) : null}

      <LogTradeForm
        action={logTradeFormAction}
        opportunityId={opportunity?.id ?? null}
        defaults={{
          capitalUsedMzn: opportunity?.capitalMzn ? Number(opportunity.capitalMzn) : null,
          buyPrice:
            opportunity?.buyVwap != null
              ? Number(opportunity.buyVwap)
              : snapshot?.bestAsk != null
                ? Number(snapshot.bestAsk)
                : null,
          sellPrice:
            opportunity?.sellVwap != null
              ? Number(opportunity.sellVwap)
              : snapshot?.bestBid != null
                ? Number(snapshot.bestBid)
                : null,
        }}
      />
    </div>
  );
}
