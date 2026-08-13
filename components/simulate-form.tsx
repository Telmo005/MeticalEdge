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
    hint: "Compra a um só comerciante e vende a um só — sem sobrar USDT por vender a mais ninguém.",
    icon: Scale,
  },
  {
    value: "equilibrado-2",
    label: "Equilibrado — até 2 por lado",
    hint: "Como acima, mas permite até 2 comerciantes de cada lado se isso deixar negociar mais.",
    icon: Scale,
  },
  {
    value: "um-para-varios",
    label: "Comprar de 1, vender a vários",
    hint: "Compra tudo a um só comerciante, depois espalha a venda por quantos comerciantes forem precisos.",
    icon: Users,
  },
  {
    value: "capital",
    label: "Usar capital todo",
    hint: "Compra e vende o máximo possível do capital configurado, mesmo que precise de muitos comerciantes de cada lado.",
    icon: Wallet,
  },
];

export function SimulateForm({
  defaultCapital,
  mode,
}: {
  defaultCapital: number;
  mode: TradeMode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(String(defaultCapital));

  function goTo(nextCapital: string, nextMode: TradeMode) {
    startTransition(() => {
      router.push(`/simulacao?capital=${encodeURIComponent(nextCapital)}&modo=${nextMode}`);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    goTo(value, mode);
  }

  return (
    <div className="flex flex-col gap-4">
      <ProcessingOverlay show={isPending} message="A simular..." />
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capital">Simular com quanto capital (MZN)?</Label>
          <Input
            id="capital"
            name="capital"
            type="number"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full sm:w-48"
          />
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
