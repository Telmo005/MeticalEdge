import { notFound } from "next/navigation";
import { getPendingOperationById, getLatestSnapshot } from "@/lib/queries";
import { finalizeOperationFormAction } from "@/lib/actions/pending-operations";
import { Card, CardLabel } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { formatMzn, formatUsdt } from "@/lib/utils";

export default async function FinalizeOperationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [operation, snapshot] = await Promise.all([getPendingOperationById(id), getLatestSnapshot()]);

  if (!operation) notFound();
  if (operation.status !== "aguardando_venda") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-lg font-semibold">Finalizar operação</h1>
        <Card>
          <p className="text-sm text-[var(--muted)]">Esta operação já foi concluída ou cancelada.</p>
        </Card>
      </div>
    );
  }

  const suggestedSellPrice = snapshot?.bestBid ? Number(snapshot.bestBid) : Number(operation.targetSellPrice ?? 0);
  const suggestedGross = suggestedSellPrice * Number(operation.usdtAmount);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Finalizar operação</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Regista o que realmente aconteceu ao vender — isto conclui a operação, cria o registo no histórico
          e faz o teu capital evoluir.
        </p>
      </div>

      <Card>
        <CardLabel>Compra já registada</CardLabel>
        <p className="text-sm text-[var(--muted)]">
          Compraste {formatUsdt(operation.usdtAmount)} a {formatMzn(operation.buyPrice)}/USDT, usando{" "}
          {formatMzn(operation.capitalUsedMzn)}. Em espera há{" "}
          {Math.floor((Date.now() - new Date(operation.startedAt).getTime()) / 60000)} minutos.
        </p>
      </Card>

      <form action={finalizeOperationFormAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={operation.id} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sellPrice">Preço de venda (MZN/USDT)</Label>
            <Input
              id="sellPrice"
              name="sellPrice"
              type="number"
              step="0.0001"
              required
              defaultValue={suggestedSellPrice || undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mznReceivedGross">Recebeste no total, bruto (MZN)</Label>
            <Input
              id="mznReceivedGross"
              name="mznReceivedGross"
              type="number"
              step="0.01"
              required
              defaultValue={suggestedGross ? suggestedGross.toFixed(2) : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feesPaidMzn">Taxas pagas (MZN)</Label>
            <Input id="feesPaidMzn" name="feesPaidMzn" type="number" step="0.01" defaultValue="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="netProfitMzn">Lucro líquido real (MZN)</Label>
            <Input id="netProfitMzn" name="netProfitMzn" type="number" step="0.01" />
            <p className="text-xs text-[var(--muted)]">
              Se deixares em branco, calcula-se automaticamente: (recebido − gasto na compra) − taxas.
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

        <SubmitButton pendingText="A finalizar..." className="self-start">
          Finalizar operação
        </SubmitButton>
      </form>
    </div>
  );
}
