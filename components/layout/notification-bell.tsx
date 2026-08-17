"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { markAllAlertsReadAction, markAlertReadAction } from "@/lib/actions/notifications";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { cn } from "@/lib/utils";
import type { Alert } from "@/db/schema";

/** Severidade derivada de `kind` (sem alterar o schema) — para o painel
 *  destacar visualmente o que precisa de atenção (erro/kill switch) do
 *  que é só informativo. */
const SEVERITY: Record<Alert["kind"], "critical" | "warning" | "info"> = {
  erro: "critical",
  limite_perda: "critical",
  bot_parado: "critical",
  perda: "warning",
  oportunidade_importante: "warning",
  execucao: "info",
  lucro: "info",
  saldo_atualizado: "info",
  teste: "info",
};
const SEVERITY_BORDER: Record<"critical" | "warning" | "info", string> = {
  critical: "border-l-[var(--critical)]",
  warning: "border-l-[var(--warning)]",
  info: "border-l-transparent",
};

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
 *  push (app fechada, sem dados, gateway em baixo). O corpo guardado é a
 *  simulação/resultado completo do alerta, por isso cada item
 *  começa colapsado (só a primeira linha) e expande ao tocar — mostrar tudo
 *  logo de início tornaria a lista enorme. Usado na sidebar e na barra
 *  superior mobile. */
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllAlertsReadAction();
    });
  }

  function handleToggle(id: string, readAt: Date | null) {
    setExpandedId((cur) => (cur === id ? null : id));
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
          <div className="absolute right-0 z-50 mt-2 w-96 max-w-[92vw] rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl">
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
            <div className="max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[var(--muted)]">Sem notificações ainda.</p>
              ) : (
                alerts.map((a) => {
                  const isExpanded = expandedId === a.id;
                  const firstLine = a.body.split("\n")[0];
                  const severity = SEVERITY[a.kind] ?? "info";
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleToggle(a.id, a.readAt)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 border-b border-l-4 border-[var(--border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--surface-2)]",
                        SEVERITY_BORDER[severity],
                        !a.readAt && "bg-[var(--accent-2)]/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--foreground)]">{a.title}</span>
                        <span className="shrink-0 text-[10px] text-[var(--muted)]">
                          {timeAgo(new Date(a.sentAt))}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs text-[var(--muted)]",
                          isExpanded ? "whitespace-pre-line" : "truncate"
                        )}
                      >
                        {isExpanded ? a.body : firstLine}
                      </span>
                      {!isExpanded && a.body.includes("\n") ? (
                        <span className="text-[10px] text-[var(--accent-2)]">ver simulação completa</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
