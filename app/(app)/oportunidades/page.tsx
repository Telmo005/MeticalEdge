import { getRecentOpportunitiesSummary, getOpportunityCounts } from "@/lib/queries";
import { Card, CardLabel } from "@/components/ui/card";
import { OpportunitiesTable } from "@/components/dashboard/opportunities-table";

export default async function OportunidadesPage() {
  const [opportunities, counts24h] = await Promise.all([
    getRecentOpportunitiesSummary(150),
    getOpportunityCounts(24),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Oportunidades</h1>
        <p className="text-sm text-[var(--muted)]">
          Todas as comparações Binance ↔ Bybit avaliadas pelo motor, válidas e rejeitadas, com o motivo de cada
          rejeição — o robô só executa a melhor oportunidade que passa em todos os filtros de segurança.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardLabel>Avaliadas (24h)</CardLabel><div className="tabular text-xl">{counts24h.total}</div></Card>
        <Card><CardLabel>Válidas (24h)</CardLabel><div className="tabular text-xl text-[var(--good)]">{counts24h.passed}</div></Card>
        <Card><CardLabel>Rejeitadas (24h)</CardLabel><div className="tabular text-xl">{counts24h.rejected}</div></Card>
      </div>

      <Card><OpportunitiesTable opportunities={opportunities} /></Card>
    </div>
  );
}
