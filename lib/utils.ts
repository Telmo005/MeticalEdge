import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMzn(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " MZN";
}

export function formatPct(value: number | string | null | undefined, digits = 2): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function formatUsdt(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(4)} USDT`;
}

/** Conversão aproximada de MZN para USD usando a taxa de referência (não a
 *  taxa P2P) — só para dar noção de grandeza a quem pensa em dólares, nunca
 *  usado nos cálculos de lucro em si (esses ficam sempre em MZN). */
export function formatUsdApprox(mzn: number | string | null | undefined, referenceUsdMzn: number | null): string | null {
  if (!referenceUsdMzn) return null;
  const n = typeof mzn === "string" ? Number(mzn) : mzn;
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const usd = n / referenceUsdMzn;
  return `${usd >= 0 ? "≈ " : "≈ -"}${new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(usd))} USD`;
}
