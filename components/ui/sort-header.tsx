"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cabeçalho de coluna clicável para ordenar tabelas — mesmo padrão em toda
 *  a app (tocar ordena, tocar outra vez inverte), para ninguém ter de
 *  adivinhar como reorganizar uma lista. */
export function SortHeader<K extends string>({
  label, align = "left", sortKey, active, dir, onClick, className,
}: {
  label: string;
  align?: "left" | "right";
  sortKey: K;
  active: boolean;
  dir: "asc" | "desc";
  onClick: (key: K) => void;
  className?: string;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={cn("px-3 py-2", align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-[var(--fg)]",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
      </button>
    </th>
  );
}
