import { getLatestSnapshot } from "@/lib/queries";
import { merchantCrossSide, topMerchantsByActivity } from "@/lib/p2p/analysis";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { RefreshButton } from "@/components/refresh-button";
import { CrossSideTable } from "@/components/comerciantes/cross-side-table";
import { TopMerchantsTable } from "@/components/comerciantes/top-merchants-table";

export default async function ComerciantesPage() {
  const snapshot = await getLatestSnapshot();
  const askAds = snapshot?.askAds ?? [];
  const bidAds = snapshot?.bidAds ?? [];

  const crossSide = merchantCrossSide(askAds, bidAds);
  const top = topMerchantsByActivity(askAds, bidAds, 300);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Comerciantes conhecidos</h1>
          <p className="text-sm text-[var(--muted)]">
            Quem aparece a comprar E a vender USDT ao mesmo tempo é, provavelmente, quem está a fazer
            market making — cobra mais para vender do que paga para comprar, e vive dessa margem própria.
          </p>
        </div>
        <RefreshButton />
      </div>

      {!snapshot ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Ainda não há nenhuma varredura registada.</p>
        </Card>
      ) : (
        <Tabs
          tabs={[
            {
              key: "cross-side",
              label: `Activos nos dois lados (${crossSide.length})`,
              content: (
                <div>
                  <CrossSideTable rows={crossSide} />
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Margem própria positiva (verde) = cobra mais para vender do que paga para comprar — o
                    padrão racional de quem faz o mercado. Negativa (amarelo) = os dois anúncios estão
                    desalinhados entre si, provavelmente sem coordenação central.
                  </p>
                </div>
              ),
            },
            {
              key: "top",
              label: `Maior volume (${top.length})`,
              content: <TopMerchantsTable rows={top} />,
            },
          ]}
        />
      )}
    </div>
  );
}
