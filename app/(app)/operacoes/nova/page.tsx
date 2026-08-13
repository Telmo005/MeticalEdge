import { getOpportunityById } from "@/lib/queries";
import { startOperationFormAction } from "@/lib/actions/pending-operations";
import { Card, CardLabel } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";

export default async function NewOperationPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunityId?: string }>;
}) {
  const { opportunityId } = await searchParams;
  const opportunity = opportunityId ? await getOpportunityById(opportunityId) : null;

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
            gravar.
          </p>
        </Card>
      ) : null}

      <form action={startOperationFormAction} className="flex flex-col gap-4">
        <input type="hidden" name="opportunityId" value={opportunity?.id ?? ""} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capitalUsedMzn">Capital gasto na compra (MZN)</Label>
            <Input
              id="capitalUsedMzn"
              name="capitalUsedMzn"
              type="number"
              step="0.01"
              required
              defaultValue={opportunity?.capitalMzn ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="buyPrice">Preço de compra (MZN/USDT)</Label>
            <Input
              id="buyPrice"
              name="buyPrice"
              type="number"
              step="0.0001"
              required
              defaultValue={opportunity?.buyVwap ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usdtAmount">USDT comprado</Label>
            <Input
              id="usdtAmount"
              name="usdtAmount"
              type="number"
              step="0.00000001"
              required
              defaultValue={opportunity?.usdtAmount ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="targetSellPrice">Preço de venda a que valia a pena (MZN/USDT)</Label>
            <Input
              id="targetSellPrice"
              name="targetSellPrice"
              type="number"
              step="0.0001"
              defaultValue={opportunity?.sellVwap ?? undefined}
            />
            <p className="text-xs text-[var(--muted)]">
              O sistema avisa-te quando aparecer um comprador a este preço ou melhor. Deixa em branco se não
              tiveres a certeza.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notas</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </div>

        <SubmitButton pendingText="A iniciar..." className="self-start">
          Iniciar operação — ficar em espera para vender
        </SubmitButton>
      </form>
    </div>
  );
}
