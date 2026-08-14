import { getRecentIntlOpportunities } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { IntlOpportunitiesTable } from "@/components/arbitragem-intl/intl-opportunities-table";
import { TARGET_PAIRS, INACTIVE_PAIRS } from "@/lib/p2p/intl/pairs-config";

export default async function ArbitragemIntlPage() {
  const opportunitiesList = await getRecentIntlOpportunities();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Arbitragem P2P internacional — Fase 1</h1>
        <p className="text-sm text-[var(--muted)]">
          Validação de spreads entre plataformas ({TARGET_PAIRS.map((p) => p.pairLabel).join(", ")}),
          independente do motor USDT/MZN. Ver STRATEGY.md e .planning/PHASE1_PLAN.md.
        </p>
      </div>

      {INACTIVE_PAIRS.length > 0 && (
        <Card className="border-[var(--warning)]">
          <p className="text-sm text-[var(--warning)]">
            {INACTIVE_PAIRS.length} par(es) fora da varredura — Binance P2P sem anúncios activos:{" "}
            {INACTIVE_PAIRS.map((p) => `${p.pairLabel} (${p.reason})`).join("; ")}.
          </p>
        </Card>
      )}

      <Card>
        <IntlOpportunitiesTable opportunities={opportunitiesList} />
      </Card>
    </div>
  );
}
