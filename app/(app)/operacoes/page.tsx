import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getPendingOperations, getRecentFinishedOperations, getLatestSnapshot } from "@/lib/queries";
import { cancelOperationFormAction } from "@/lib/actions/pending-operations";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { RefreshButton } from "@/components/refresh-button";
import { formatMzn, formatUsdt } from "@/lib/utils";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function OperationsPage() {
  const [pending, finished, snapshot] = await Promise.all([
    getPendingOperations(),
    getRecentFinishedOperations(10),
    getLatestSnapshot(),
  ]);

  const currentBestBid = snapshot?.bestBid ? Number(snapshot.bestBid) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Operações em curso</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Compras já feitas à espera de um bom comprador para o USDT. O sistema vigia o mercado sozinho e
            avisa-te (push/SMS) assim que aparecer alguém a pagar o preço-alvo ou mais — não precisas de
            estar a verificar.
          </p>
        </div>
        <RefreshButton />
      </div>

      {pending.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhuma operação em espera agora. Quando comprares USDT e ainda não tiveres a quem vender, usa
            &ldquo;Iniciar operação&rdquo; no Painel — fica aqui até finalizares a venda.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((op) => {
            const target = op.targetSellPrice ? Number(op.targetSellPrice) : null;
            const reached = target !== null && currentBestBid !== null && currentBestBid >= target;
            return (
              <Card key={op.id} className={reached ? "border-l-4 border-l-[var(--good)]" : "border-l-4 border-l-[var(--warning)]"}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[var(--muted)]" />
                    <CardTitle className="text-base">Em espera há {timeAgo(new Date(op.startedAt))}</CardTitle>
                  </div>
                  {reached ? (
                    <Badge tone="good">há comprador ao preço-alvo agora</Badge>
                  ) : (
                    <Badge tone="warning">ainda à espera de bom preço</Badge>
                  )}
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <CardLabel>USDT preso nesta operação</CardLabel>
                    <div className="tabular font-semibold">{formatUsdt(op.usdtAmount)}</div>
                  </div>
                  <div>
                    <CardLabel>Capital preso</CardLabel>
                    <div className="tabular font-semibold">{formatMzn(op.capitalUsedMzn)}</div>
                  </div>
                  <div>
                    <CardLabel>Comprado a</CardLabel>
                    <div className="tabular">{formatMzn(op.buyPrice)}/USDT</div>
                  </div>
                  <div>
                    <CardLabel>Preço-alvo de venda</CardLabel>
                    <div className="tabular">{target !== null ? `${formatMzn(target)}/USDT` : "não definido"}</div>
                  </div>
                </div>

                {currentBestBid !== null ? (
                  <p className="mb-4 text-xs text-[var(--muted)]">
                    Melhor comprador agora no mercado: {formatMzn(currentBestBid)}/USDT
                    {target !== null && !reached ? ` — falta ${formatMzn(target - currentBestBid)} para o teu alvo` : ""}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Link href={`/operacoes/${op.id}/finalizar`}>
                    <Button>Finalizar — já vendi</Button>
                  </Link>
                  <form action={cancelOperationFormAction}>
                    <input type="hidden" name="id" value={op.id} />
                    <SubmitButton
                      variant="secondary"
                      pendingText="A cancelar..."
                      confirmMessage="Cancelar esta operação? Não conta como negócio feito, só arquiva — usa isto se desistires de vender."
                    >
                      Cancelar
                    </SubmitButton>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {finished.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Concluídas ou canceladas recentemente</h2>
          <div className="flex flex-col gap-2">
            {finished.map((op) => (
              <div
                key={op.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  {op.status === "concluida" ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--good)]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[var(--muted)]" />
                  )}
                  <span>{formatUsdt(op.usdtAmount)}</span>
                  <span className="text-[var(--muted)]">
                    {op.status === "concluida" ? "vendido" : "cancelada"}
                    {op.finalizedAt ? ` — ${new Date(op.finalizedAt).toLocaleString("pt-PT")}` : ""}
                  </span>
                </div>
                {op.status === "concluida" && op.netProfitMzn !== null ? (
                  <span className="tabular font-semibold">{formatMzn(op.netProfitMzn)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
