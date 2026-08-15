"use client";

import { useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { InputWithSuffix, Input, Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import { TARGET_PAIRS } from "@/lib/p2p/intl/pairs-config";

const PLATFORM_OPTIONS = [
  { id: "binance_p2p", label: "Binance P2P" },
  { id: "bybit_p2p", label: "Bybit P2P" },
];

function formatUsd2(n: number): string {
  return new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " USD";
}

/** Regista um ciclo já executado — mesmo espírito de
 *  components/trades/log-trade-form.tsx (só pedir o que a pessoa sabe de
 *  facto, calcular o resto ao vivo), adaptado a USD/plataformas em vez de
 *  MZN/comerciantes individuais. */
export function LogIntlTradeForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [pairAndRegion, setPairAndRegion] = useState(`${TARGET_PAIRS[0].pairLabel}|${TARGET_PAIRS[0].region}`);
  const [platformBuy, setPlatformBuy] = useState("binance_p2p");
  const [platformSell, setPlatformSell] = useState("bybit_p2p");
  const [capitalStr, setCapitalStr] = useState("");
  const [buyPriceStr, setBuyPriceStr] = useState("");
  const [sellPriceStr, setSellPriceStr] = useState("");
  const [feesStr, setFeesStr] = useState("0");

  const capital = Number(capitalStr) || 0;
  const buyPrice = Number(buyPriceStr) || 0;
  const sellPrice = Number(sellPriceStr) || 0;
  const fees = Number(feesStr) || 0;

  const asset = capital > 0 && buyPrice > 0 ? capital / buyPrice : 0;
  const received = asset * sellPrice;
  const gross = received - capital;
  const net = gross - fees;

  const canSubmit = capital > 0 && buyPrice > 0 && sellPrice > 0 && platformBuy !== platformSell;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="pairAndRegion" value={pairAndRegion} />
      <input type="hidden" name="netProfitUsd" value={Number.isFinite(net) ? net.toFixed(2) : ""} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pairAndRegion">Par</Label>
          <Select
            id="pairAndRegionSelect"
            value={pairAndRegion}
            onChange={(e) => setPairAndRegion(e.target.value)}
          >
            {TARGET_PAIRS.map((p) => (
              <option key={p.pairLabel} value={`${p.pairLabel}|${p.region}`}>
                {p.pairLabel} — {p.region}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="executedAt">Data/hora do ciclo</Label>
          <Input id="executedAt" name="executedAt" type="datetime-local" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="platformBuySelect">Comprou em</Label>
          <Select
            id="platformBuySelect"
            name="platformBuy"
            value={platformBuy}
            onChange={(e) => setPlatformBuy(e.target.value)}
          >
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="platformSellSelect">Vendeu em</Label>
          <Select
            id="platformSellSelect"
            name="platformSell"
            value={platformSell}
            onChange={(e) => setPlatformSell(e.target.value)}
          >
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capitalUsedUsd">Capital usado</Label>
          <InputWithSuffix
            id="capitalUsedUsd"
            name="capitalUsedUsd"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            suffix="USD"
            value={capitalStr}
            onChange={(e) => setCapitalStr(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feesPaidUsd">Taxas pagas</Label>
          <InputWithSuffix
            id="feesPaidUsd"
            name="feesPaidUsd"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            suffix="USD"
            value={feesStr}
            onChange={(e) => setFeesStr(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="buyPrice">Preço de compra</Label>
          <Input
            id="buyPrice"
            name="buyPrice"
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            required
            value={buyPriceStr}
            onChange={(e) => setBuyPriceStr(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sellPrice">Preço de venda</Label>
          <Input
            id="sellPrice"
            name="sellPrice"
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            required
            value={sellPriceStr}
            onChange={(e) => setSellPriceStr(e.target.value)}
          />
        </div>
      </div>

      {platformBuy === platformSell ? (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
          Comprar e vender na mesma plataforma não é arbitragem — escolhe duas plataformas diferentes.
        </p>
      ) : null}

      {canSubmit ? (
        <Card className={cn("border-l-4", net >= 0 ? "border-l-[var(--good)]" : "border-l-[var(--critical)]")}>
          <CardLabel>Resultado que vai ficar no histórico</CardLabel>
          <div className={cn("tabular text-2xl font-bold", net >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]")}>
            {net >= 0 ? "+" : ""}
            {formatUsd2(net)}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Gastaste {formatUsd2(capital)} → recebeste {formatUsd2(received)} → taxas {formatUsd2(fees)}.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Com quem negociaste, o que correu bem ou mal." />
      </div>

      <SubmitButton pendingText="A gravar..." disabled={!canSubmit} className="self-start">
        Gravar ciclo
      </SubmitButton>
    </form>
  );
}
