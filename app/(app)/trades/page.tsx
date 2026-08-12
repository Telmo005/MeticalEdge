import Link from "next/link";
import { getRecentTrades } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradesTable } from "@/components/trades/trades-table";

export default async function TradesPage() {
  const tradesList = await getRecentTrades();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Operações reportadas</h1>
        <Link href="/trades/new">
          <Button>Registar operação</Button>
        </Link>
      </div>

      {tradesList.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Ainda não reportaste nenhuma operação. Depois de executar uma na Binance, regista-a aqui — é o
            que faz o teu capital evoluir dentro do sistema.
          </p>
        </Card>
      ) : (
        <TradesTable trades={tradesList} />
      )}
    </div>
  );
}
