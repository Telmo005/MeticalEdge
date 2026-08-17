import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getBotSettings, getExchangeBalances, getUnreadAlertsCount, getRecentAlerts } from "@/lib/queries";
import { formatUsdt } from "@/lib/utils";
import { SidebarNav, BottomTabBar } from "@/components/layout/nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { AutoRefresh } from "@/components/auto-refresh";
import { AppFooter } from "@/components/layout/app-footer";

// Todas as páginas aqui dentro leem dados ao vivo (saldo, oportunidades,
// notificações) atrás de autenticação — nunca devem ser pré-geradas em
// build.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [settings, exchangeBalances, unreadCount, recentAlerts] = await Promise.all([
    getBotSettings(),
    getExchangeBalances(),
    getUnreadAlertsCount(),
    getRecentAlerts(15),
  ]);

  const balance = exchangeBalances.reduce((sum, b) => sum + Number(b.totalValueUsdt), 0);
  const killSwitchOn = settings?.killSwitchEngaged ?? false;

  return (
    <div className="min-h-dvh lg:flex">
      <AutoRefresh />
      {/* Sidebar — desktop apenas */}
      <aside className="hidden shrink-0 flex-col justify-between border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-4 py-5 lg:flex lg:h-dvh lg:w-64 lg:sticky lg:top-0">
        <div>
          <div className="mb-6 flex items-center gap-2 px-2">
            <TrendingUp className="h-5 w-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm font-bold text-[var(--sidebar-fg)]">MeticalEdge</p>
              <p className="text-[11px] text-[var(--sidebar-muted)]">Robô de arbitragem cripto</p>
            </div>
          </div>
          <SidebarNav />
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-active)] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-[var(--sidebar-muted)]">Saldo real</p>
            <p className="tabular text-sm font-semibold text-[var(--sidebar-fg)]">{formatUsdt(balance)}</p>
            {killSwitchOn ? (
              <p className="mt-1 text-[11px] font-semibold text-[var(--critical)]">BOT PARADO</p>
            ) : null}
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
            <div className="tabular text-xs font-semibold text-[var(--muted)]">{formatUsdt(balance)}</div>
            <NotificationBell
              unreadCount={unreadCount}
              alerts={recentAlerts}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            />
            <SignOutButton compact />
          </div>
        </header>

        {/* Barra superior — desktop apenas */}
        <header className="sticky top-0 z-30 hidden h-14 items-center justify-end border-b border-[var(--border)] bg-[var(--surface)] px-6 lg:flex">
          <NotificationBell unreadCount={unreadCount} alerts={recentAlerts} />
        </header>

        <main className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto max-w-5xl">
            {children}
            <AppFooter className="mt-10 border-t border-[var(--border)] pt-4" />
          </div>
        </main>
      </div>

      <BottomTabBar />
    </div>
  );
}
