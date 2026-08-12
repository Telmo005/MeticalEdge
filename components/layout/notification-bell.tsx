"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { markAllAlertsReadAction, markAlertReadAction } from "@/lib/actions/notifications";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { cn } from "@/lib/utils";
import type { Alert } from "@/db/schema";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Sino de notificações dentro da app — duplica o alerta push num registo
 *  persistente que fica visível mesmo que o telemóvel não tenha recebido o
 *  push (app fechada, sem dados, gateway em baixo). Usado na sidebar e na
 *  barra superior mobile. */
export function NotificationBell({
  unreadCount,
  alerts,
  className,
}: {
  unreadCount: number;
  alerts: Alert[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllAlertsReadAction();
    });
  }

  function handleOpenAlert(id: string, readAt: Date | null) {
    if (!readAt) {
      startTransition(async () => {
        await markAlertReadAction(id);
      });
    }
  }

  return (
    <div className="relative">
      <ProcessingOverlay show={isPending} message="A actualizar notificações..." />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        className={cn("relative text-[var(--sidebar-muted)] hover:text-[var(--sidebar-fg)]", className)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--critical)] px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Notificações</span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-[var(--accent-2)] hover:underline"
                >
                  Marcar todas como lidas
                </button>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[var(--muted)]">Sem notificações ainda.</p>
              ) : (
                alerts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleOpenAlert(a.id, a.readAt)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b border-[var(--border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--surface-2)]",
                      !a.readAt && "bg-[var(--accent-2)]/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{a.title}</span>
                      <span className="shrink-0 text-[10px] text-[var(--muted)]">
                        {timeAgo(new Date(a.sentAt))}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--muted)] line-clamp-2">{a.body}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
