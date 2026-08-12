"use client";

import { Loader2 } from "lucide-react";

/**
 * Indicador de carregamento cobrindo a página inteira, não só o botão que o
 * disparou — pedido explícito para que quem não é técnico veja claramente
 * que o sistema está a trabalhar, mesmo que não esteja a olhar para o
 * botão exacto que carregou.
 */
export function ProcessingOverlay({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[1px]"
    >
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-4 shadow-xl">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        <span className="text-sm font-medium text-[var(--foreground)]">{message}</span>
      </div>
    </div>
  );
}
