import { ArrowRight } from "lucide-react";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollTable } from "@/components/ui/scroll-table";
import { cn, formatMzn, formatPct } from "@/lib/utils";
import type { PayMethodArbitrage } from "@/lib/p2p/patterns";

/**
 * Diferenças de preço entre métodos de pagamento.
 *
 * A análise por preço puro mistura tudo no mesmo saco e por isso nunca
 * revela isto: quem só aceita transferência bancária costuma pagar melhor
 * do que quem aceita M-Pesa, porque tem menos concorrência e mais fricção.
 * Comprar por um método e vender por outro é uma margem que existe mesmo em
 * livro normal — e que não aparecia em lado nenhum da app.
 */
export function PayMethodPanel({ arbitrage }: { arbitrage: PayMethodArbitrage }) {
  const { buySides, sellSides, best, edgeOverSameMethodPct, pairs } = arbitrage;

  if (buySides.length === 0 || sellSides.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">
          É preciso haver pelo menos dois anúncios por método em cada lado do livro — senão um anúncio
          isolado com preço fora da realidade faria parecer que há uma oportunidade onde não há.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {best ? (
        <Card
          className={cn(
            edgeOverSameMethodPct !== null && edgeOverSameMethodPct > 0.1 && "border-l-4 border-l-[var(--good)]"
          )}
        >
          <CardTitle>Melhor combinação de métodos agora</CardTitle>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <CardLabel>Compras pagando por</CardLabel>
              <div className="text-sm font-semibold">{best.buyMethod.method}</div>
              <div className="tabular text-xs text-[var(--muted)]">
                {formatMzn(best.buyMethod.bestPrice)} · {best.buyMethod.bestMerchant}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <div className="min-w-0">
              <CardLabel>Vendes recebendo por</CardLabel>
              <div className="text-sm font-semibold">{best.sellMethod.method}</div>
              <div className="tabular text-xs text-[var(--muted)]">
                {formatMzn(best.sellMethod.bestPrice)} · {best.sellMethod.bestMerchant}
              </div>
            </div>
            <div className="ml-auto text-right">
              <CardLabel>Diferença</CardLabel>
              <div
                className={cn(
                  "tabular text-xl font-bold",
                  best.spreadPct > 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
                )}
              >
                {formatPct(best.spreadPct)}
              </div>
            </div>
          </div>

          {edgeOverSameMethodPct !== null ? (
            <p className="mt-4 rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]">
              {edgeOverSameMethodPct > 0.05 ? (
                <>
                  Usar métodos diferentes em cada perna rende mais{" "}
                  <b className="tabular text-[var(--foreground)]">
                    {edgeOverSameMethodPct.toFixed(2)} pontos percentuais
                  </b>{" "}
                  do que ficar no mesmo método dos dois lados. Confirma que consegues mesmo movimentar
                  dinheiro entre as duas contas antes de contar com isto.
                </>
              ) : (
                <>
                  Neste momento não compensa cruzar métodos — ficar no mesmo dos dois lados dá praticamente o
                  mesmo, com menos passos.
                </>
              )}
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <MethodSide title="Onde compras USDT mais barato" sides={buySides} />
        <MethodSide title="Onde vendes USDT mais caro" sides={sellSides} />
      </div>

      <Card>
        <CardTitle>Combinações ordenadas</CardTitle>
        <p className="mb-3 mt-1 text-sm text-[var(--muted)]">
          Diferença de preço entre pagar por um método e receber por outro, do melhor para o pior.
        </p>
        <ScrollTable maxHeight="360px">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="px-3 py-2">Pagas por</th>
                <th className="px-3 py-2">Recebes por</th>
                <th className="px-3 py-2 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {pairs.slice(0, 10).map((p, i) => (
                <tr
                  key={`${p.buyMethod.method}-${p.sellMethod.method}-${i}`}
                  className="border-t border-[var(--border)]"
                >
                  <td className="px-3 py-2">
                    <div className="truncate">{p.buyMethod.method}</div>
                    <div className="tabular text-xs text-[var(--muted)]">
                      {formatMzn(p.buyMethod.bestPrice)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="truncate">{p.sellMethod.method}</div>
                        <div className="tabular text-xs text-[var(--muted)]">
                          {formatMzn(p.sellMethod.bestPrice)}
                        </div>
                      </div>
                      {p.sameMethod ? <Badge tone="neutral">mesmo método</Badge> : null}
                    </div>
                  </td>
                  <td
                    className={cn(
                      "tabular px-3 py-2 text-right font-semibold",
                      p.spreadPct > 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
                    )}
                  >
                    {formatPct(p.spreadPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      </Card>
    </div>
  );
}

function MethodSide({ title, sides }: { title: string; sides: PayMethodArbitrage["buySides"] }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <ul className="mt-3 flex flex-col gap-2">
        {sides.slice(0, 6).map((s, i) => (
          <li
            key={s.method}
            className="flex items-center justify-between gap-3 rounded-md bg-[var(--surface-2)] px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {i === 0 ? <Badge tone="good">melhor</Badge> : null}
                <span className="truncate text-sm">{s.method}</span>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {s.nAds} {s.nAds === 1 ? "anúncio" : "anúncios"} · {formatMzn(s.liquidityMzn)} disponíveis
              </span>
            </div>
            <span className="tabular shrink-0 text-sm font-semibold">{formatMzn(s.bestPrice)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
