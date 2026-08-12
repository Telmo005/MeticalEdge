import Link from "next/link";
import { getRecentTrades } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollTable } from "@/components/ui/scroll-table";
import { formatMzn } from "@/lib/utils";

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
        <ScrollTable>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2 text-right">Capital usado</th>
                <th className="px-3 py-2 text-right">Compra</th>
                <th className="px-3 py-2 text-right">Venda</th>
                <th className="px-3 py-2 text-right">Lucro líquido</th>
                <th className="px-3 py-2">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {tradesList.map((t) => (
                <tr key={t.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {new Date(t.executedAt).toLocaleString("pt-PT")}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(t.capitalUsedMzn)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(t.buyPrice)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(t.sellPrice)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatMzn(t.netProfitMzn)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={t.outcome === "success" ? "good" : t.outcome === "partial" ? "warning" : "critical"}>
                      {t.outcome}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
    </div>
  );
}
