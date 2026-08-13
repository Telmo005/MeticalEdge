"use client";

import { useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { InputWithSuffix, Input, Label, FieldHint, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { cn, formatMzn, formatUsdt } from "@/lib/utils";

/**
 * Registo de uma operação completa.
 *
 * O formulário anterior tinha oito caixas numéricas soltas — capital,
 * preços, USDT, lucro bruto, taxas E lucro líquido — todas independentes e
 * nenhuma verificada contra as outras. Bastava um engano num campo para o
 * histórico ficar com uma operação impossível, e nada avisava. Aqui só se
 * pedem os valores que a pessoa realmente sabe; os restantes são calculados
 * e mostrados enquanto se escreve.
 */
export function LogTradeForm({
  action,
  opportunityId,
  defaults,
}: {
  action: (formData: FormData) => void | Promise<void>;
  opportunityId: string | null;
  defaults: {
    capitalUsedMzn: number | null;
    buyPrice: number | null;
    sellPrice: number | null;
  };
}) {
  const [capitalStr, setCapitalStr] = useState(
    defaults.capitalUsedMzn ? String(Math.round(defaults.capitalUsedMzn * 100) / 100) : ""
  );
  const [buyPriceStr, setBuyPriceStr] = useState(defaults.buyPrice ? defaults.buyPrice.toFixed(2) : "");
  const [sellPriceStr, setSellPriceStr] = useState(defaults.sellPrice ? defaults.sellPrice.toFixed(2) : "");
  const [feesStr, setFeesStr] = useState("0");

  const capital = Number(capitalStr) || 0;
  const buyPrice = Number(buyPriceStr) || 0;
  const sellPrice = Number(sellPriceStr) || 0;
  const fees = Number(feesStr) || 0;

  const usdt = buyPrice > 0 ? capital / buyPrice : 0;
  const received = usdt * sellPrice;
  const gross = received - capital;
  const net = gross - fees;

  const canSubmit = capital > 0 && buyPrice > 0 && sellPrice > 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="opportunityId" value={opportunityId ?? ""} />
      <input type="hidden" name="usdtAmount" value={usdt > 0 ? usdt.toFixed(8) : ""} />
      <input type="hidden" name="grossProfitMzn" value={Number.isFinite(gross) ? gross.toFixed(2) : ""} />
      <input type="hidden" name="netProfitMzn" value={Number.isFinite(net) ? net.toFixed(2) : ""} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capitalUsedMzn">Capital usado na compra</Label>
          <InputWithSuffix
            id="capitalUsedMzn"
            name="capitalUsedMzn"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            suffix="MZN"
            value={capitalStr}
            onChange={(e) => setCapitalStr(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="executedAt">Data/hora da operação</Label>
          <Input id="executedAt" name="executedAt" type="datetime-local" />
          <FieldHint>Deixa em branco para usar agora.</FieldHint>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="buyPrice">Preço de compra</Label>
          <InputWithSuffix
            id="buyPrice"
            name="buyPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            suffix="MZN/USDT"
            value={buyPriceStr}
            onChange={(e) => setBuyPriceStr(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sellPrice">Preço de venda</Label>
          <InputWithSuffix
            id="sellPrice"
            name="sellPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            suffix="MZN/USDT"
            value={sellPriceStr}
            onChange={(e) => setSellPriceStr(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feesPaidMzn">Taxas pagas</Label>
          <InputWithSuffix
            id="feesPaidMzn"
            name="feesPaidMzn"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            suffix="MZN"
            value={feesStr}
            onChange={(e) => setFeesStr(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="outcome">Resultado</Label>
          <Select id="outcome" name="outcome" defaultValue="success">
            <option value="success">Sucesso — preencheu como esperado</option>
            <option value="partial">Parcial — sobrou USDT/MZN por negociar</option>
            <option value="loss">Prejuízo</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-[var(--surface-2)] px-3 py-2.5 text-sm">
        <span className="text-[var(--muted)]">
          USDT negociado: <b className="tabular text-[var(--foreground)]">{usdt > 0 ? formatUsdt(usdt) : "—"}</b>
        </span>
        {sellPrice > 0 ? (
          <span className="text-[var(--muted)]">
            Recebeste: <b className="tabular text-[var(--foreground)]">{formatMzn(received)}</b>
          </span>
        ) : null}
      </div>

      {canSubmit ? (
        <Card
          className={cn("border-l-4", net >= 0 ? "border-l-[var(--good)]" : "border-l-[var(--critical)]")}
        >
          <CardLabel>Resultado que vai ficar no histórico</CardLabel>
          <div
            className={cn(
              "tabular text-2xl font-bold",
              net >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
            )}
          >
            {net >= 0 ? "+" : ""}
            {formatMzn(net)}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Gastaste {formatMzn(capital)} → recebeste {formatMzn(received)} → taxas {formatMzn(fees)}.
          </p>
        </Card>
      ) : null}

      {capital > 0 && buyPrice > 0 && sellPrice > 0 && sellPrice < buyPrice ? (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
          Vendeste mais barato do que compraste. Confirma os dois preços — se foi mesmo assim, está certo e a
          operação fica registada como prejuízo.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Com quem negociaste, o que correu bem ou mal."
        />
      </div>

      <SubmitButton pendingText="A gravar..." disabled={!canSubmit} className="self-start">
        Gravar operação
      </SubmitButton>
    </form>
  );
}
