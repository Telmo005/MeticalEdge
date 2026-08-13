"use client";

import { useMemo, useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InputWithSuffix, Label, FieldHint, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { cn, formatMzn, formatUsdt } from "@/lib/utils";

export type StartOperationDefaults = {
  capitalUsedMzn: number | null;
  buyPrice: number | null;
  usdtAmount: number | null;
  targetSellPrice: number | null;
};

/**
 * Formulário de "já comprei, falta vender".
 *
 * O anterior pedia ao mesmo tempo o capital gasto, o preço de compra E a
 * quantidade de USDT — três valores que se determinam uns aos outros, sem
 * verificar que batiam certo. Era fácil gravar 5.000 MZN a 68,00 com 50
 * USDT (o correcto seriam 73,5) e só dar por isso semanas depois, com o
 * histórico de lucro já corrompido.
 *
 * Agora o USDT é calculado a partir dos outros dois, e o preço-alvo mostra
 * ao vivo o lucro que traria — que era a pergunta que ninguém conseguia
 * responder ao preencher esse campo.
 */
export function StartOperationForm({
  action,
  defaults,
  opportunityId,
  availableCapitalMzn,
  currentBestBid,
  estimatedFeeMznPerOrder,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults: StartOperationDefaults;
  opportunityId: string | null;
  availableCapitalMzn: number;
  currentBestBid: number | null;
  /** Custo estimado por ordem, para calcular o preço de equilíbrio. */
  estimatedFeeMznPerOrder: number;
}) {
  const [capitalStr, setCapitalStr] = useState(
    defaults.capitalUsedMzn ? String(Math.round(defaults.capitalUsedMzn * 100) / 100) : ""
  );
  const [buyPriceStr, setBuyPriceStr] = useState(defaults.buyPrice ? defaults.buyPrice.toFixed(2) : "");
  const [targetStr, setTargetStr] = useState(
    defaults.targetSellPrice ? defaults.targetSellPrice.toFixed(2) : ""
  );

  const capital = Number(capitalStr) || 0;
  const buyPrice = Number(buyPriceStr) || 0;
  const target = Number(targetStr) || 0;

  const usdt = buyPrice > 0 ? capital / buyPrice : 0;

  /** Preço a que a operação empata: recupera o gasto e as taxas das duas
   *  pernas, nem mais nem menos. Abaixo disto, vender é perder. */
  const breakEven = useMemo(() => {
    if (usdt <= 0) return 0;
    return (capital + estimatedFeeMznPerOrder * 2) / usdt;
  }, [capital, usdt, estimatedFeeMznPerOrder]);

  const projected = useMemo(() => {
    if (usdt <= 0 || target <= 0) return null;
    const gross = usdt * target;
    const net = gross - capital - estimatedFeeMznPerOrder * 2;
    return { gross, net };
  }, [usdt, target, capital, estimatedFeeMznPerOrder]);

  const overCapital = capital > 0 && capital > availableCapitalMzn + 0.5;
  const targetBelowBreakEven = target > 0 && breakEven > 0 && target < breakEven;
  const canSubmit = capital > 0 && buyPrice > 0 && usdt > 0;

  const suggestions = useMemo(() => {
    if (breakEven <= 0) return [];
    return [
      { label: "Empatar", price: breakEven },
      { label: "+0,5%", price: breakEven * 1.005 },
      { label: "+1%", price: breakEven * 1.01 },
      { label: "+2%", price: breakEven * 1.02 },
    ];
  }, [breakEven]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="opportunityId" value={opportunityId ?? ""} />
      <input type="hidden" name="usdtAmount" value={usdt > 0 ? usdt.toFixed(8) : ""} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capitalUsedMzn">Capital gasto na compra</Label>
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
      </div>

      {/* O USDT deixou de ser um campo livre: é o resultado dos dois valores
          acima. Foi assim que os três números deixaram de se contradizer. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-[var(--surface-2)] px-3 py-2.5 text-sm">
        <span className="text-[var(--muted)]">
          USDT comprado: <b className="tabular text-[var(--foreground)]">{usdt > 0 ? formatUsdt(usdt) : "—"}</b>
        </span>
        {breakEven > 0 ? (
          <span className="text-[var(--muted)]">
            Empatas a <b className="tabular text-[var(--foreground)]">{formatMzn(breakEven)}/USDT</b>
          </span>
        ) : null}
      </div>

      {overCapital ? (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
          Gastaste mais do que o capital livre registado ({formatMzn(availableCapitalMzn)}). Confirma o
          valor, ou actualiza o capital em Configurações.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="targetSellPrice">Preço de venda a que vale a pena</Label>
        <InputWithSuffix
          id="targetSellPrice"
          name="targetSellPrice"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          suffix="MZN/USDT"
          value={targetStr}
          onChange={(e) => setTargetStr(e.target.value)}
        />
        <FieldHint>
          O sistema avisa-te (push e SMS) quando aparecer um comprador a este preço ou melhor. Deixa em
          branco se não quiseres ser avisado por preço.
        </FieldHint>
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Sugestões:</span>
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setTargetStr(s.price.toFixed(2))}
              className={cn(
                "tabular rounded-md border px-2.5 py-1 text-xs transition-colors",
                Math.abs(target - s.price) < 0.005
                  ? "border-[var(--accent-2)] bg-[var(--accent-2)]/10 text-[var(--accent-2)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
              )}
            >
              {s.label} · {s.price.toFixed(2)}
            </button>
          ))}
        </div>
      ) : null}

      {currentBestBid !== null && usdt > 0 ? (
        <p className="text-xs text-[var(--muted)]">
          Melhor comprador no mercado agora: <b className="tabular">{formatMzn(currentBestBid)}/USDT</b>
          {target > 0 && currentBestBid >= target ? (
            <Badge tone="good" className="ml-2">
              já dá para vender
            </Badge>
          ) : target > 0 ? (
            <span className="tabular"> — falta {formatMzn(target - currentBestBid)} para o teu alvo</span>
          ) : null}
        </p>
      ) : null}

      {projected ? (
        <Card
          className={cn(
            "border-l-4",
            projected.net >= 0 ? "border-l-[var(--good)]" : "border-l-[var(--critical)]"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-[var(--muted)]">
              Gastaste {formatMzn(capital)} → receberias {formatMzn(projected.gross)} a esse preço
            </span>
            <div className="text-right">
              <CardLabel className="mb-0">Lucro se vender ali</CardLabel>
              <div
                className={cn(
                  "tabular text-lg font-bold",
                  projected.net >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
                )}
              >
                {projected.net >= 0 ? "+" : ""}
                {formatMzn(projected.net)}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {targetBelowBreakEven ? (
        <p className="rounded-md bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
          A este preço perdes dinheiro. Só empatas a partir de {formatMzn(breakEven)}/USDT — abaixo disso as
          taxas comem mais do que a diferença de preço.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Ex.: comprei ao João, pagamento por M-Pesa, demorou 8 minutos a libertar."
        />
      </div>

      <SubmitButton pendingText="A iniciar..." disabled={!canSubmit} className="self-start">
        Iniciar operação — ficar em espera para vender
      </SubmitButton>
    </form>
  );
}
