"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { cn } from "@/lib/utils";

function Inner({ compact }: { compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <ProcessingOverlay show={pending} message="A sair..." />
      <button
        type="submit"
        disabled={pending}
        aria-label="Sair"
        className={cn(
          "flex items-center gap-2.5 text-[var(--sidebar-muted)] hover:text-[var(--sidebar-fg)] disabled:opacity-50",
          compact ? "text-[var(--muted)] hover:text-[var(--foreground)]" : "w-full rounded-md px-3 py-2 text-sm hover:bg-[var(--sidebar-active)]"
        )}
      >
        <LogOut className="h-4 w-4" />
        {compact ? null : "Sair"}
      </button>
    </>
  );
}

/** Usado na sidebar (texto completo) e na barra superior mobile (só ícone,
 *  compact=true) — mostra sempre o overlay de página inteira enquanto a
 *  sessão termina. */
export function SignOutButton({ compact }: { compact?: boolean }) {
  return (
    <form action={signOutAction}>
      <Inner compact={compact} />
    </form>
  );
}
