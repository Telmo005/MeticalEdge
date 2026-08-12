import { getOpportunityById } from "@/lib/queries";
import { logTradeFormAction } from "@/lib/actions/trades";
import { Card, CardLabel } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";

export default async function NewTradePage({
  searchParams,
}: {
  searchParams: Promise<{ opportunityId?: string }>;
}) {
  const { opportunityId } = await searchParams;
  const opportunity = opportunityId ? await getOpportunityById(opportunityId) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Registar operação</h1>

      {opportunity ? (
        <Card>
          <CardLabel>Pré-preenchido a partir da oportunidade avaliada</CardLabel>
          <p className="text-sm text-[var(--muted)]">
            Os valores abaixo vêm da simulação — ajusta-os para o que realmente aconteceu na Binance antes de
            gravar.
          </p>
        </Card>
      ) : null}

      <form action={logTradeFormAction} className="flex flex-col gap-4">
        <input type="hidden" name="opportunityId" value={opportunity?.id ?? ""} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capitalUsedMzn">Capital usado (MZN)</Label>
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
            <Label htmlFor="executedAt">Data/hora da operação</Label>
            <Input id="executedAt" name="executedAt" type="datetime-local" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="buyPrice">Preço de compra (MZN/USDT)</Label>
            <Input
              id="buyPrice"
              name="buyPrice"
              type="number"
              step="0.0001"
              defaultValue={opportunity?.buyVwap ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sellPrice">Preço de venda (MZN/USDT)</Label>
            <Input
              id="sellPrice"
              name="sellPrice"
              type="number"
              step="0.0001"
              defaultValue={opportunity?.sellVwap ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usdtAmount">Quantidade USDT</Label>
            <Input
              id="usdtAmount"
              name="usdtAmount"
              type="number"
              step="0.00000001"
              defaultValue={opportunity?.usdtAmount ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grossProfitMzn">Lucro bruto (MZN)</Label>
            <Input
              id="grossProfitMzn"
              name="grossProfitMzn"
              type="number"
              step="0.01"
              defaultValue={opportunity?.grossProfitMzn ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feesPaidMzn">Taxas pagas (MZN)</Label>
            <Input id="feesPaidMzn" name="feesPaidMzn" type="number" step="0.01" defaultValue="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="netProfitMzn">Lucro líquido real (MZN)</Label>
            <Input
              id="netProfitMzn"
              name="netProfitMzn"
              type="number"
              step="0.01"
              defaultValue={opportunity?.netProfitMediumMzn ?? undefined}
            />
            <p className="text-xs text-[var(--muted)]">
              Se deixares em branco, calcula-se automaticamente: bruto − taxas.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="outcome">Resultado</Label>
          <select
            id="outcome"
            name="outcome"
            defaultValue="success"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="success">Sucesso — preencheu como esperado</option>
            <option value="partial">Parcial — sobrou USDT/MZN por vender</option>
            <option value="loss">Prejuízo</option>
          </select>
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

        <SubmitButton pendingText="A gravar..." className="self-start">
          Gravar operação
        </SubmitButton>
      </form>
    </div>
  );
}
