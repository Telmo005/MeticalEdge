import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getSettings, getUnreadAlertsCount, getRecentAlerts } from "@/lib/queries";
import { formatMzn } from "@/lib/utils";
import { SidebarNav, BottomTabBar } from "@/components/layout/nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { NotificationBell } from "@/components/layout/notification-bell";

// Todas as páginas aqui dentro leem dados ao vivo (mercado, capital,
// notificações) atrás de autenticação — nunca devem ser pré-geradas em
// build (isso executaria as queries contra a base de dados durante `next
// build`, sem sessão nenhuma, e serviria uma cópia estática desactualizada
// depois). Isto também evita o build tentar pré-renderizar estas páginas
// e estourar o limite de tempo por página.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [config, unreadCount, recentAlerts] = await Promise.all([
    getSettings(),
    getUnreadAlertsCount(),
    getRecentAlerts(15),
  ]);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar — desktop apenas */}
      <aside className="hidden shrink-0 flex-col justify-between border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-4 py-5 lg:flex lg:h-dvh lg:w-64 lg:sticky lg:top-0">
        <div>
          <div className="mb-6 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-bold text-[var(--sidebar-fg)]">MeticalEdge</p>
                <p className="text-[11px] text-[var(--sidebar-muted)]">Monitor USDT/MZN</p>
              </div>
            </div>
            <NotificationBell unreadCount={unreadCount} alerts={recentAlerts} />
          </div>
          <SidebarNav />
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-active)] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-[var(--sidebar-muted)]">
              Capital configurado
            </p>
            <p className="tabular text-sm font-semibold text-[var(--sidebar-fg)]">
              {formatMzn(config?.currentCapitalMzn)}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex-1">
        {/* Barra superior — mobile apenas */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-sm font-bold">MeticalEdge</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="tabular text-xs font-semibold text-[var(--muted)]">
              {formatMzn(config?.currentCapitalMzn)}
            </div>
            <NotificationBell
              unreadCount={unreadCount}
              alerts={recentAlerts}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            />
            <SignOutButton compact />
          </div>
        </header>

        <main className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      <BottomTabBar />
    </div>
  );
}
