import { cn } from "@/lib/utils";

type CalloutTone = "info" | "good" | "warning" | "critical";

/** Mesmas classes que já eram usadas à mão nas páginas — passaram para aqui
 *  só para não estarem repetidas em dez sítios. O aspecto é o mesmo. */
const TONE: Record<CalloutTone, string> = {
  info: "bg-[var(--surface-2)] text-[var(--muted)]",
  good: "bg-[var(--good-bg)] text-[var(--good)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  critical: "bg-[var(--critical-bg)] text-[var(--critical)]",
};

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: CalloutTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md px-3 py-2 text-sm", TONE[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}
