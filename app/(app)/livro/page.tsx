import { getLatestSnapshot } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { RefreshButton } from "@/components/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { SortableAdsTable, type AdRow } from "@/components/livro/sortable-ads-table";
import { maxMznExecutable, type Ad } from "@/lib/p2p/orderbook";

function toRows(ads: Ad[]): AdRow[] {
  return ads.map((ad) => ({
    advNo: ad.advNo,
    price: ad.price,
    merchantName: ad.merchantName,
    minMzn: ad.minMzn,
    maxExecutable: maxMznExecutable(ad),
    monthOrders: ad.monthOrders,
    monthFinishRate: ad.monthFinishRate,
    payMethods: ad.payMethods,
  }));
}

export default async function LivroPage() {
  const snapshot = await getLatestSnapshot();
  const askRows = toRows(snapshot?.askAds ?? []);
  const bidRows = toRows(snapshot?.bidAds ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Livro de ofertas — USDT/MZN</h1>
          <p className="text-sm text-[var(--muted)]">
            Todos os anúncios da última varredura, não só o melhor preço — sempre do teu ponto de vista
            (&ldquo;pagas&rdquo;/&ldquo;recebes&rdquo;), não do comerciante. Repara no &ldquo;Mín.&rdquo;: um
            preço óptimo com mínimo muito maior do que o teu capital não serve — não é uma opção real para ti,
            é por isso que a Simulação às vezes não o usa mesmo parecendo o melhor preço aqui. Toca num
            cabeçalho de coluna para ordenar. Reputação em vermelho significa poucas ordens/mês ou baixa taxa
            de conclusão — evita negociar com essas contas mesmo que o preço pareça bom.
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
              key: "tu-vendes",
              label: `Onde tu vendes USDT (${bidRows.length})`,
              content: <SortableAdsTable ads={bidRows} priceLabel="Quanto recebes" defaultSortDir="desc" />,
            },
            {
              key: "tu-compras",
              label: `Onde tu compras USDT (${askRows.length})`,
              content: <SortableAdsTable ads={askRows} priceLabel="Quanto pagas" defaultSortDir="asc" />,
            },
          ]}
        />
      )}
    </div>
  );
}
