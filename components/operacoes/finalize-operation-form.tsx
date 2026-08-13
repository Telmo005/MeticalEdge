"use client";

import { useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { InputWithSuffix, Label, FieldHint, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { cn, formatMzn, formatUsdt } from "@/lib/utils";

/**
 * Fecho da operação.
 *
 * O formulário anterior pedia preço de venda, total recebido, taxas E lucro
 * líquido — quatro números em que três se determinam. O "lucro líquido
 * real" ficava opcional, com uma nota a explicar a fórmula, o que obrigava
 * a fazer contas de cabeça para saber se se estava a gravar um valor
 * coerente. Aqui o total e o lucro são calculados a partir do preço, e o
 * total continua editável para os casos em que a Binance arredonda de
 * forma diferente — mas o valor por omissão está sempre certo.
 */
export function FinalizeOperationForm({
  action,
  operationId,
  usdtAmount,
  capitalUsedMzn,
  suggestedSellPrice,
  targetSellPrice,
}: {
  action: (formData: FormData) => void | Promise<void>;
  operationId: string;
  usdtAmount: number;
  capitalUsedMzn: number;
  suggestedSellPrice: number;
  targetSellPrice: number | null;
}) {
  const [sellPriceStr, setSellPriceStr] = useState(
    suggestedSellPrice > 0 ? suggestedSellPrice.toFixed(2) : ""
  );
  const [feesStr, setFeesStr] = useState("0");
  const [grossOverride, setGrossOverride] = useState("");

  const sellPrice = Number(sellPriceStr) || 0;
  const fees = Number(feesStr) || 0;

  const computedGross = usdtAmount * sellPrice;
  const gross = grossOverride !== "" ? Number(grossOverride) || 0 : computedGross;
  const net = gross - capitalUsedMzn - fees;

  const grossDrifted =
    grossOverride !== "" && computedGross > 0 && Math.abs(gross - computedGross) / computedGross > 0.02;

  const canSubmit = sellPrice > 0 && gross > 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={operationId} />
      <input type="hidden" name="mznReceivedGross" value={gross > 0 ? gross.toFixed(2) : ""} />
      <input type="hidden" name="netProfitMzn" value={Number.isFinite(net) ? net.toFixed(2) : ""} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          {targetSellPrice !== null ? (
            <FieldHint>
              O teu alvo era {formatMzn(targetSellPrice)}/USDT
              {sellPrice > 0 && sellPrice < targetSellPrice ? " — vendeste abaixo dele." : ""}
            </FieldHint>
          ) : null}
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
          <FieldHint>Taxas da Binance e de transferência. Deixa 0 se não sabes ao certo.</FieldHint>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="grossOverride">Total recebido (só se for diferente do calculado)</Label>
          <InputWithSuffix
            id="grossOverride"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            suffix="MZN"
            placeholder={computedGross > 0 ? computedGross.toFixed(2) : ""}
            value={grossOverride}
            onChange={(e) => setGrossOverride(e.target.value)}
          />
          <FieldHint>
            Calculado: {formatUsdt(usdtAmount)} × {formatMzn(sellPrice)} ={" "}
            <b className="tabular">{formatMzn(computedGross)}</b>
          </FieldHint>
        </div>
      </div>

      {grossDrifted ? (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
          O total que escreveste afasta-se mais de 2% do que o preço indica. Verifica se o preço de venda
          está certo — um dos dois números não corresponde ao que aconteceu.
        </p>
      ) : null}

      <Card
        className={cn("border-l-4", net >= 0 ? "border-l-[var(--good)]" : "border-l-[var(--critical)]")}
      >
        <CardLabel>Resultado desta operação</CardLabel>
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
          Gastaste {formatMzn(capitalUsedMzn)} → recebeste {formatMzn(gross)} → taxas {formatMzn(fees)}.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Ao gravar, esta operação sai da lista de espera, entra no histórico e o capital configurado é
          ajustado neste valor.
        </p>
      </Card>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Ex.: o comprador demorou a pagar, tive de esperar 40 minutos."
        />
      </div>

      <SubmitButton pendingText="A finalizar..." disabled={!canSubmit} className="self-start">
        Finalizar operação
      </SubmitButton>
    </form>
  );
}
