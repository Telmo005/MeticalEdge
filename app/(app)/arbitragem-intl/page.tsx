import Link from "next/link";
import { getRecentIntlOpportunities } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { IntlOpportunitiesTable } from "@/components/arbitragem-intl/intl-opportunities-table";
import { TARGET_PAIRS, INACTIVE_PAIRS } from "@/lib/p2p/intl/pairs-config";

export default async function ArbitragemIntlPage() {
  const opportunitiesList = await getRecentIntlOpportunities();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Arbitragem internacional</h1>
        <p className="text-sm text-[var(--muted)]">
          Compara Binance P2P com Bybit P2P em {TARGET_PAIRS.length} pares ({TARGET_PAIRS.map((p) => p.pairLabel).join(", ")})
          e mostra onde comprar barato e vender caro agora.
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Motor e capital independentes do mercado local — ver{" "}
          <Link href="/simulacao" className="text-[var(--accent-2)] hover:underline">
            Simulação de lucro (MZN)
          </Link>{" "}
          para USDT/MZN, ou{" "}
          <Link href="/settings" className="text-[var(--accent-2)] hover:underline">
            Configurações
          </Link>{" "}
          para ajustar o capital usado aqui.
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
