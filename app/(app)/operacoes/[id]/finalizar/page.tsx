import { notFound } from "next/navigation";
import { getPendingOperationById, getLatestSnapshot } from "@/lib/queries";
import { finalizeOperationFormAction } from "@/lib/actions/pending-operations";
import { Card, CardLabel } from "@/components/ui/card";
import { FinalizeOperationForm } from "@/components/operacoes/finalize-operation-form";
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

  const usdtAmount = Number(operation.usdtAmount);
  const capitalUsedMzn = Number(operation.capitalUsedMzn);
  const targetSellPrice = operation.targetSellPrice ? Number(operation.targetSellPrice) : null;

  // Preferimos o mercado de agora ao alvo teórico: quem acabou de vender
  // vendeu perto do melhor comprador do momento.
  const bestBid = snapshot?.bestBid ? Number(snapshot.bestBid) : 0;
  const suggestedSellPrice = bestBid || targetSellPrice || Number(operation.buyPrice);

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
          Compraste {formatUsdt(usdtAmount)} a {formatMzn(operation.buyPrice)}/USDT, usando{" "}
          {formatMzn(capitalUsedMzn)}. Em espera há{" "}
          {Math.floor((Date.now() - new Date(operation.startedAt).getTime()) / 60000)} minutos.
        </p>
      </Card>

      <FinalizeOperationForm
        action={finalizeOperationFormAction}
        operationId={operation.id}
        usdtAmount={usdtAmount}
        capitalUsedMzn={capitalUsedMzn}
        suggestedSellPrice={suggestedSellPrice}
        targetSellPrice={targetSellPrice}
      />
    </div>
  );
}
