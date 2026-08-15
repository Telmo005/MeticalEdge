"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scale, Users, Wallet } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { cn } from "@/lib/utils";

export type TradeMode = "capital" | "equilibrado-1" | "equilibrado-2" | "um-para-varios";

const MODE_OPTIONS: { value: TradeMode; label: string; hint: string; icon: React.ElementType }[] = [
  {
    value: "equilibrado-1",
    label: "Equilibrado — 1 por lado",
    hint: "Procura o melhor par: um comerciante para comprar, outro para vender. Menos taxas e execução rápida.",
    icon: Scale,
  },
  {
    value: "equilibrado-2",
    label: "Equilibrado — até 2 por lado",
    hint: "Como acima, mas pode usar dois de cada lado se a combinação render mais.",
    icon: Scale,
  },
  {
    value: "um-para-varios",
    label: "Comprar de 1, vender a vários",
    hint: "Escolhe o melhor comerciante para comprar tudo, depois espalha a venda por quantos forem precisos.",
    icon: Users,
  },
  {
    value: "capital",
    label: "Usar capital todo",
    hint: "Compra e vende o máximo possível do capital configurado, mesmo que precise de muitos comerciantes de cada lado.",
    icon: Wallet,
  },
];

type Unit = "MZN" | "USD";

export function SimulateForm({
  defaultCapital,
  mode,
  referenceUsdMzn,
}: {
  defaultCapital: number;
  mode: TradeMode;
  /** Taxa de referência USD/MZN (não a taxa P2P) — só para converter o que
   *  a pessoa digita em USD para o MZN que o resto da página usa por baixo.
   *  Sem isto o campo em USD não tem para onde converter. */
  referenceUsdMzn: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [unit, setUnit] = useState<Unit>("MZN");
  const [value, setValue] = useState(String(defaultCapital));

  function goTo(nextCapitalMzn: string, nextMode: TradeMode) {
    startTransition(() => {
      router.push(`/simulacao?capital=${encodeURIComponent(nextCapitalMzn)}&modo=${nextMode}`);
    });
  }

  function toMzn(raw: string): string {
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;
    if (unit === "MZN" || !referenceUsdMzn) return raw;
    return String(Math.round(n * referenceUsdMzn));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    goTo(toMzn(value), mode);
  }

  function switchUnit(next: Unit) {
    if (next === unit) return;
    const n = Number(value);
    if (Number.isFinite(n) && referenceUsdMzn) {
      setValue(next === "USD" ? (n / referenceUsdMzn).toFixed(2) : String(Math.round(n * referenceUsdMzn)));
    }
    setUnit(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <ProcessingOverlay show={isPending} message="A simular..." />
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capital">Simular com quanto capital?</Label>
          <div className="flex gap-2">
            <Input
              id="capital"
              name="capital"
              type="number"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full sm:w-40"
            />
            <div className="flex overflow-hidden rounded-md border border-[var(--border)]">
              {(["MZN", "USD"] as Unit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => switchUnit(u)}
                  disabled={u === "USD" && !referenceUsdMzn}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    unit === u
                      ? "bg-[var(--accent-2)] text-white"
                      : "bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          {unit === "USD" && referenceUsdMzn ? (
            <p className="text-xs text-[var(--muted)]">≈ {Math.round(Number(value) * referenceUsdMzn)} MZN ao câmbio de referência</p>
          ) : null}
        </div>
        <Button type="submit" disabled={isPending}>
          Simular
        </Button>
      </form>

      <div>
        <Label className="mb-2 block">Como negociar</Label>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isPending}
                onClick={() => goTo(value, opt.value)}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-[var(--accent-2)] bg-[var(--accent-2)]/10"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-[var(--accent-2)]" : "text-[var(--muted)]")} />
                <span className={cn("text-sm font-semibold", active ? "text-[var(--accent-2)]" : "text-[var(--foreground)]")}>
                  {opt.label}
                </span>
                <span className="text-xs text-[var(--muted)]">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
