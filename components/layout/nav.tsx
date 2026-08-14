"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Calculator, ListChecks, Hourglass, Settings, Users, Globe, type LucideIcon } from "lucide-react";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { cn } from "@/lib/utils";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/operacoes", label: "Em curso", icon: Hourglass },
  { href: "/livro", label: "Livro", icon: BookOpen },
  { href: "/simulacao", label: "Simulação", icon: Calculator },
  { href: "/comerciantes", label: "Comerc.", icon: Users },
  { href: "/trades", label: "Histórico", icon: ListChecks },
  { href: "/arbitragem-intl", label: "Internacional", icon: Globe },
  { href: "/settings", label: "Config.", icon: Settings },
];

const FULL_LABEL: Record<string, string> = {
  "Config.": "Configurações",
  Livro: "Livro de ofertas",
  "Comerc.": "Comerciantes",
  "Em curso": "Operações em curso",
  Histórico: "Histórico de operações",
  Internacional: "Arbitragem internacional (Fase 1)",
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Mostra o overlay de página inteira enquanto a navegação deste link em
 *  concreto está em curso — useLinkStatus só reporta pending para o <Link>
 *  que o envolve, por isso este componente tem de viver dentro de cada um. */
function LinkPendingOverlay({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <ProcessingOverlay show={pending} message={`A abrir ${label}...`} />;
}

/** Navegação da sidebar (desktop, lg+). */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const label = FULL_LABEL[item.label] ?? item.label;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[var(--sidebar-active)] font-semibold text-[var(--sidebar-fg)]"
                : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-active)]"
            )}
          >
            <LinkPendingOverlay label={label} />
            <Icon className={cn("h-4 w-4", active ? "text-[var(--accent)]" : "text-[var(--sidebar-muted)]")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior fixa (mobile, abaixo de lg) — mesmo padrão do Duelo
 *  (components/layout/mobile-tab-bar.tsx): é o único caminho de volta às
 *  outras secções num ecrã de telemóvel, sem depender do botão "recuar" do
 *  browser. */
export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          const label = FULL_LABEL[item.label] ?? item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-12 flex-1 flex-col items-center justify-center gap-1 py-2 text-[9px] font-semibold",
                active ? "text-[var(--accent)]" : "text-[var(--sidebar-muted)]"
              )}
            >
              <LinkPendingOverlay label={label} />
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
