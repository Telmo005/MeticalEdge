import { Store, Clock } from "lucide-react";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatMzn, formatPct, formatUsdt } from "@/lib/utils";
import type { MakerAnalysis, FillRisk } from "@/lib/p2p/maker";

const RISK_TONE: Record<FillRisk, "good" | "warning" | "critical"> = {
  baixo: "good",
  medio: "warning",
  alto: "critical",
};

const RISK_TEXT: Record<FillRisk, string> = {
  baixo: "executa já",
  medio: "espera provável",
  alto: "espera longa possível",
};

/**
 * Estratégia de anúncio próprio.
 *
 * Este painel existe porque a app inteira estava construída à volta de uma
 * única forma de ganhar dinheiro — aceitar anúncios alheios quando o livro
 * cruza — que só acontece uns minutos por dia e rende 0,2%–0,5%. Publicar
 * anúncio próprio dentro do spread funciona com o livro normal, que é
 * quase sempre, e a margem é o spread inteiro. O preço a pagar é tempo, e
 * isso é dito em cada cartão em vez de escondido atrás do número bonito.
 */
export function MakerPanel({ analysis }: { analysis: MakerAnalysis }) {
  const { strategies, best, spreadAbsMzn, spreadPct, bestAsk, bestBid } = analysis;

  if (strategies.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">
          É preciso haver anúncios dos dois lados do livro na última varredura para avaliar anúncios
          próprios.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="border-l-4 border-l-[var(--accent-2)]">
        <CardTitle>O espaço que podes ocupar</CardTitle>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Entre o comprador que paga mais e o vendedor mais barato há um vazio. Quem publica um anúncio nesse
          vazio fica em primeiro lugar da lista e fica com a diferença — é isto que os comerciantes em
          /comerciantes fazem todos os dias.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <CardLabel>Melhor comprador</CardLabel>
            <div className="tabular">{formatMzn(bestBid)}</div>
          </div>
          <div>
            <CardLabel>Vendedor mais barato</CardLabel>
            <div className="tabular">{formatMzn(bestAsk)}</div>
          </div>
          <div>
            <CardLabel>Espaço livre</CardLabel>
            <div className="tabular font-semibold text-[var(--accent-2)]">
              {spreadAbsMzn === null ? "—" : formatMzn(spreadAbsMzn)}
            </div>
          </div>
          <div>
            <CardLabel>Em percentagem</CardLabel>
            <div className="tabular font-semibold text-[var(--accent-2)]">{formatPct(spreadPct)}</div>
          </div>
        </div>
      </Card>

      <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
        <b>Isto não é execução imediata.</b> Um anúncio próprio fica publicado à espera de contraparte.
        Enquanto espera, o capital está comprometido e o preço pode mover-se contra ti. É a estratégia de
        margem mais alta e de risco mais alto — a única aqui que depende de paciência, não de rapidez.
      </p>

      {strategies.map((s) => {
        const isBest = best?.key === s.key;
        return (
          <Card
            key={s.key}
            className={cn(
              "flex flex-col gap-4",
              isBest && "border-l-4 border-l-[var(--good)]",
              !s.available && "opacity-70"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <Store
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isBest ? "text-[var(--good)]" : "text-[var(--muted)]"
                  )}
                />
                <div className="min-w-0">
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={RISK_TONE[s.fillRisk]}>
                      <Clock className="h-3 w-3" />
                      {RISK_TEXT[s.fillRisk]}
                    </Badge>
                    <Badge tone="neutral">
                      {s.legsWaiting === 0
                        ? "nada fica à espera"
                        : s.legsWaiting === 1
                          ? "1 perna à espera"
                          : "2 pernas à espera"}
                    </Badge>
                    {s.available ? <Badge tone="neutral">margem {formatPct(s.marginPct)}</Badge> : null}
                  </div>
                </div>
              </div>

              {s.available ? (
                <div className="shrink-0 text-right">
                  <CardLabel>Lucro líquido</CardLabel>
                  <div className="tabular text-xl font-bold text-[var(--good)]">+{formatMzn(s.netMzn)}</div>
                  <p className="text-xs text-[var(--muted)]">
                    {formatPct(s.netPct)} sobre {formatMzn(s.capitalUsedMzn)}
                  </p>
                </div>
              ) : null}
            </div>

            {s.available ? (
              <>
                <ol className="flex flex-col gap-2">
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-2)] text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="grid grid-cols-2 gap-4 rounded-md bg-[var(--surface-2)] p-3 sm:grid-cols-4">
                  <div>
                    <CardLabel>Preço de compra</CardLabel>
                    <div className="tabular text-sm">{formatMzn(s.buyPrice)}</div>
                  </div>
                  <div>
                    <CardLabel>Preço de venda</CardLabel>
                    <div className="tabular text-sm">{formatMzn(s.sellPrice)}</div>
                  </div>
                  <div>
                    <CardLabel>USDT envolvido</CardLabel>
                    <div className="tabular text-sm">{formatUsdt(s.usdtAmount)}</div>
                  </div>
                  <div>
                    <CardLabel>Anúncios à tua frente</CardLabel>
                    <div className="tabular text-sm">
                      {(s.buyLeg?.adsAhead ?? 0) + (s.sellLeg?.adsAhead ?? 0)}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[var(--muted)]">{s.riskNote}</p>
              </>
            ) : (
              <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]">
                {s.unavailableReason ?? "Não disponível com o mercado de agora."}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
