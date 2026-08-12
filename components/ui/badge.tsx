import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeTone = "good" | "warning" | "critical" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  good: "bg-[var(--good-bg)] text-[var(--good)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  critical: "bg-[var(--critical-bg)] text-[var(--critical)]",
  neutral: "bg-[var(--surface-2)] text-[var(--muted)]",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
