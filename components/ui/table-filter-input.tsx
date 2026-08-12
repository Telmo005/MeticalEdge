"use client";

import { Search, X } from "lucide-react";

/** Caixa de pesquisa simples por texto — usada em todas as tabelas grandes
 *  para filtrar por comerciante sem precisar de percorrer páginas. */
export function TableFilterInput({
  value,
  onChange,
  placeholder = "Filtrar por comerciante...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-7 text-sm outline-none focus:border-[var(--accent-2)]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar filtro"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
