import { Crown, Zap, Layers, Store } from "lucide-react";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatMzn, formatPct } from "@/lib/utils";

export type StrategyRow = {
  key: string;
  label: string;
  description: string;
  netMzn: number;
  netPct: number;
  capitalUsedMzn: number;
  nOrders: number;
  available: boolean;
  unavailableReason?: string;
  /** Quanto tempo/incerteza envolve executar isto. */
  risk?: string;
  riskTone?: "good" | "warning" | "critical" | "neutral";
};

const ICONS: Record<string, React.ElementType> = {
  gulosa: Layers,
  "par-unico": Zap,
  "tamanho-optimo": Crown,
  "maker-total": Store,
  "compra-imediata-venda-anunciada": Store,
  "compra-anunciada-venda-imediata": Store,
};

/**
 * Todas as formas de operar, lado a lado, com os mesmos custos.
 *
 * É a peça que faltava para responder a "haverá lucro que não estamos a
 * ver?": a app só sabia calcular UM caminho (comprar do mais barato para
 * cima) e apresentava o resultado como se fosse o único possível. Aqui as
 * alternativas competem no mesmo terreno e a melhor é apontada — incluindo
 * quando a melhor é publicar anúncio próprio em vez de aceitar os que já
 * existem.
 */
export function StrategyCompare({ rows, bestKey }: { rows: StrategyRow[]; bestKey: string | null }) {
  const sorted = [...rows].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return b.netMzn - a.netMzn;
  });
  const bestNet = sorted.find((r) => r.available)?.netMzn ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map((row) => {
        const Icon = ICONS[row.key] ?? Layers;
        const isBest = row.key === bestKey && row.available;
        const gapToBest = bestNet - row.netMzn;

        return (
          <Card
            key={row.key}
            className={cn(
              "flex flex-col gap-3",
              isBest && "border-l-4 border-l-[var(--good)]",
              !row.available && "opacity-60"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2.5">
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isBest ? "text-[var(--good)]" : "text-[var(--muted)]"
                  )}
                />
                <div className="min-w-0">
                  <CardTitle>{row.label}</CardTitle>
                  <p className="mt-1 text-xs text-[var(--muted)]">{row.description}</p>
                </div>
              </div>
              {isBest ? <Badge tone="good">melhor</Badge> : null}
            </div>

            {row.available ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <CardLabel>Lucro líquido</CardLabel>
                    <div
                      className={cn(
                        "tabular text-xl font-bold",
                        row.netMzn > 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
                      )}
                    >
                      {row.netMzn > 0 ? "+" : ""}
                      {formatMzn(row.netMzn)}
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatPct(row.netPct)} · {formatMzn(row.capitalUsedMzn)} usados · {row.nOrders}{" "}
                      {row.nOrders === 1 ? "ordem" : "ordens"}
                    </p>
                  </div>
                  {!isBest && gapToBest > 0.01 ? (
                    <span className="tabular shrink-0 text-xs text-[var(--muted)]">
                      −{formatMzn(gapToBest)}
                    </span>
                  ) : null}
                </div>

                {row.risk ? (
                  <Badge tone={row.riskTone ?? "neutral"} className="w-fit">
                    {row.risk}
                  </Badge>
                ) : null}
              </>
            ) : (
              <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
                {row.unavailableReason ?? "Não disponível com o livro e o capital de agora."}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
