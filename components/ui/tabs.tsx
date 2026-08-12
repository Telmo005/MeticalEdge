"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TabDef = { key: string; label: string; content: React.ReactNode };

/** Tabs em faixa segmentada (células com divisórias, célula activa
 *  destacada) — formato pedido, adaptado à paleta da app em vez do
 *  sublinhado usado antes. */
export function Tabs({ tabs, defaultTab }: { tabs: TabDef[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
        {tabs.map((t, i) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              aria-pressed={isActive}
              className={cn(
                "relative flex-1 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                i > 0 && "border-l border-[var(--border)]",
                isActive
                  ? "bg-[var(--surface)] text-[var(--accent)] font-semibold"
                  : "text-[var(--muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--foreground)]"
              )}
            >
              {t.label}
              {isActive ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent)]" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
      {activeTab?.content}
    </div>
  );
}
