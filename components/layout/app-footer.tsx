import { cn } from "@/lib/utils";

export function AppFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("text-center text-xs text-[var(--muted)]", className)}>
      Desenvolvido por Telmo Jr. — +258 84 20 10 505
    </footer>
  );
}
