import { getLatestSnapshot } from "@/lib/queries";
import { merchantCrossSide, topMerchantsByActivity } from "@/lib/p2p/analysis";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { Tabs } from "@/components/ui/tabs";
import { RefreshButton } from "@/components/refresh-button";
import { formatMzn, formatPct } from "@/lib/utils";

export default async function ComerciantesPage() {
  const snapshot = await getLatestSnapshot();
  const askAds = snapshot?.askAds ?? [];
  const bidAds = snapshot?.bidAds ?? [];

  const crossSide = merchantCrossSide(askAds, bidAds);
  const top = topMerchantsByActivity(askAds, bidAds, 25);

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
                  <ScrollTable>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
                        <tr>
                          <th className="px-3 py-2">Comerciante</th>
                          <th className="px-3 py-2 text-right">Compra (paga)</th>
                          <th className="px-3 py-2 text-right">Venda (cobra)</th>
                          <th className="px-3 py-2 text-right">Margem própria</th>
                          <th className="px-3 py-2 text-right">Ordens/mês</th>
                          <th className="px-3 py-2">Métodos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crossSide.map((m) => (
                          <tr key={m.merchantId} className="border-t border-[var(--border)]">
                            <td className="px-3 py-2">{m.merchantName}</td>
                            <td className="tabular px-3 py-2 text-right">{formatMzn(m.bestBid)}</td>
                            <td className="tabular px-3 py-2 text-right">{formatMzn(m.bestAsk)}</td>
                            <td className="px-3 py-2 text-right">
                              <Badge tone={m.spreadOwnPct < 0 ? "good" : "warning"}>
                                {formatPct(-m.spreadOwnPct)}
                              </Badge>
                            </td>
                            <td className="tabular px-3 py-2 text-right text-[var(--muted)]">
                              {m.monthOrders ?? "?"}
                            </td>
                            <td className="px-3 py-2 text-[var(--muted)]">{m.payMethods.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollTable>
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
              content: (
                <ScrollTable>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
                      <tr>
                        <th className="px-3 py-2">Comerciante</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Lado(s)</th>
                        <th className="px-3 py-2 text-right">Ordens/mês</th>
                        <th className="px-3 py-2 text-right">Conclusão</th>
                        <th className="px-3 py-2 text-right">Faixa de preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top.map((m) => (
                        <tr key={m.merchantId} className="border-t border-[var(--border)]">
                          <td className="px-3 py-2">{m.merchantName}</td>
                          <td className="px-3 py-2 text-[var(--muted)]">{m.merchantType}</td>
                          <td className="px-3 py-2 text-[var(--muted)]">
                            {m.sides.includes("BUY") && m.sides.includes("SELL")
                              ? "compra + venda"
                              : m.sides.includes("SELL")
                                ? "só venda"
                                : "só compra"}
                          </td>
                          <td className="tabular px-3 py-2 text-right">{m.monthOrders ?? "?"}</td>
                          <td className="tabular px-3 py-2 text-right">
                            {((m.monthFinishRate ?? 0) * 100).toFixed(0)}%
                          </td>
                          <td className="tabular px-3 py-2 text-right text-[var(--muted)]">
                            {formatMzn(m.priceMin)} – {formatMzn(m.priceMax)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
