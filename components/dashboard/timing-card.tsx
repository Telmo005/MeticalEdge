import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { cn, formatMzn } from "@/lib/utils";
import type { TimingInsight } from "@/lib/p2p/patterns";

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}h`;
}

/**
 * Padrões por hora e por dia da semana.
 *
 * A app guardava um snapshot por minuto há dias e nunca usava esse
 * histórico para a pergunta mais prática que existe: "a que horas é que
 * vale a pena estar atento?". Se o livro cruza sobretudo às 20h, saber isso
 * rende mais do que qualquer optimização de cêntimos — e estava ali, à
 * espera de ser contado.
 */
export function TimingCard({ timing }: { timing: TimingInsight }) {
  const { hours, weekdays, bestHour, cheapestBuyHour, richestSellHour, windowDays, totalSamples } = timing;

  const maxCrossed = Math.max(0.0001, ...hours.map((h) => h.crossedRate));
  const solidHours = hours.filter((h) => h.samples > 0);
  const maxWeekdayRate = Math.max(0.0001, ...weekdays.map((x) => x.crossedRate));

  return (
    <Card>
      <CardTitle>Melhores alturas para operar</CardTitle>
      <p className="mt-1 text-sm text-[var(--muted)]">
        A partir de {totalSamples.toLocaleString("pt-PT")} varreduras dos últimos {windowDays} dias, hora
        local de Maputo. Não é previsão — é a frequência do que já aconteceu.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <CardLabel>Livro cruza mais vezes</CardLabel>
          <div className="tabular text-xl font-semibold text-[var(--good)]">
            {bestHour ? hourLabel(bestHour.hour) : "—"}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {bestHour
              ? `${(bestHour.crossedRate * 100).toFixed(1)}% das varreduras nesta hora`
              : "ainda sem janelas cruzadas registadas"}
          </p>
        </div>
        <div>
          <CardLabel>USDT mais barato</CardLabel>
          <div className="tabular text-xl font-semibold">
            {cheapestBuyHour ? hourLabel(cheapestBuyHour.hour) : "—"}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {cheapestBuyHour ? `média ${formatMzn(cheapestBuyHour.avgBestAsk)}` : ""}
          </p>
        </div>
        <div>
          <CardLabel>Vendes mais caro</CardLabel>
          <div className="tabular text-xl font-semibold">
            {richestSellHour ? hourLabel(richestSellHour.hour) : "—"}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {richestSellHour ? `média ${formatMzn(richestSellHour.avgBestBid)}` : ""}
          </p>
        </div>
      </div>

      {/* Frequência de livro cruzado por hora — uma barra por hora do dia.
          Lê-se de relance, sem eixo nenhum. */}
      <div className="mt-6">
        <CardLabel>Quando o livro cruza, hora a hora</CardLabel>
        <div className="mt-2 flex h-20 items-end gap-[3px]">
          {Array.from({ length: 24 }, (_, h) => {
            const row = solidHours.find((x) => x.hour === h);
            const rate = row?.crossedRate ?? 0;
            const height = Math.max(2, (rate / maxCrossed) * 100);
            const isBest = bestHour?.hour === h;
            return (
              <div
                key={h}
                className={cn(
                  "flex-1 rounded-t-sm",
                  isBest ? "bg-[var(--good)]" : rate > 0 ? "bg-[var(--accent-2)]" : "bg-[var(--surface-2)]"
                )}
                style={{ height: `${height}%` }}
                title={`${hourLabel(h)} — ${(rate * 100).toFixed(1)}% cruzado (${row?.samples ?? 0} amostras)`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
          <span>00h</span>
          <span>06h</span>
          <span>12h</span>
          <span>18h</span>
          <span>23h</span>
        </div>
      </div>

      {weekdays.length > 0 ? (
        <div className="mt-5">
          <CardLabel>Por dia da semana</CardLabel>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {weekdays.map((d) => (
              <div
                key={d.weekday}
                className={cn(
                  "rounded-md border border-[var(--border)] p-2 text-center",
                  d.crossedRate >= maxWeekdayRate * 0.8 && d.crossedRate > 0
                    ? "bg-[var(--good-bg)]"
                    : "bg-[var(--surface-2)]"
                )}
                title={`${d.label} — ${(d.crossedRate * 100).toFixed(1)}% cruzado`}
              >
                <div className="text-[10px] text-[var(--muted)]">{d.label.slice(0, 3)}</div>
                <div className="tabular text-xs font-semibold">{(d.crossedRate * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
