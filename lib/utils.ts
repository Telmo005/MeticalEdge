import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsdt(value: number | string | null | undefined, digits = 4): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("pt-PT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)} USDT`;
}

export function formatUsdtSigned(value: number | string | null | undefined, digits = 4): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${formatUsdt(n, digits)}`;
}

export function formatPct(value: number | string | null | undefined, digits = 2): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}
