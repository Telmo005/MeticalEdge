import { cn, formatMzn } from "@/lib/utils";
import { CardLabel } from "@/components/ui/card";

/** Rótulo + número, com as mesmas classes que as páginas já usavam
 *  (CardLabel + div.tabular). Só existe para não repetir o par em todo o
 *  lado; não muda o aspecto de nada. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "critical";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <CardLabel>{label}</CardLabel>
      <div
        className={cn(
          "tabular font-semibold",
          tone === "good" && "text-[var(--good)]",
          tone === "critical" && "text-[var(--critical)]"
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

/** Valor em Meticais que fica verde ou vermelho conforme seja ganho ou
 *  perda. */
export function MoneyStat({
  label,
  amountMzn,
  hint,
  className,
}: {
  label: string;
  amountMzn: number | null | undefined;
  hint?: React.ReactNode;
  className?: string;
}) {
  const n = amountMzn ?? null;
  return (
    <Stat
      label={label}
      value={n === null ? "—" : `${n > 0 ? "+" : ""}${formatMzn(n)}`}
      hint={hint}
      tone={n === null ? "default" : n > 0 ? "good" : n < 0 ? "critical" : "default"}
      className={className}
    />
  );
}
