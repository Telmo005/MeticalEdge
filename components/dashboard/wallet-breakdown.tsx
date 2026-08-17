"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardLabel } from "@/components/ui/card";
import { formatUsdt } from "@/lib/utils";
import type { AssetBalanceDetail } from "@/db/schema";

const EXCHANGE_LABEL: Record<string, string> = { binance: "Binance", bybit: "Bybit" };

/** Carteira detalhada por exchange — não só o total, todos os activos
 *  detidos com livre/bloqueado/valor (secção "visibilidade de carteiras").
 *  Expansível para não ocupar espaço quando não precisas de olhar. */
export function WalletBreakdown({
  exchangeId,
  totalValueUsdt,
  usdtFree,
  assetsDetail,
  updatedAt,
}: {
  exchangeId: string;
  totalValueUsdt: number;
  usdtFree: number;
  assetsDetail: AssetBalanceDetail[];
  updatedAt: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const heldAssets = assetsDetail.filter((a) => a.free > 0 || a.locked > 0);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <CardLabel>{EXCHANGE_LABEL[exchangeId] ?? exchangeId}</CardLabel>
          <div className="tabular text-xl">{formatUsdt(totalValueUsdt)}</div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatUsdt(usdtFree)} livre · {heldAssets.length} activo{heldAssets.length === 1 ? "" : "s"}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          {heldAssets.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Nenhum activo com saldo detectado.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left uppercase text-[var(--muted)]">
                <tr>
                  <th className="pb-1 font-medium">Activo</th>
                  <th className="pb-1 font-medium">Livre</th>
                  <th className="pb-1 font-medium">Bloqueado</th>
                  <th className="pb-1 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {heldAssets.map((a) => (
                  <tr key={a.asset} className="border-t border-[var(--border)]">
                    <td className="tabular py-1 font-medium">{a.asset}</td>
                    <td className="tabular py-1">{a.free}</td>
                    <td className="tabular py-1">{a.locked}</td>
                    <td className="tabular py-1 text-right">{formatUsdt(a.valueUsdt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {updatedAt ? (
            <p className="mt-2 text-[10px] text-[var(--muted)]">actualizado {new Date(updatedAt).toLocaleTimeString("pt-PT")}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
