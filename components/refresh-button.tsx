"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { refreshScanAction } from "@/lib/actions/scan";
import { Button } from "@/components/ui/button";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { cn } from "@/lib/utils";

/**
 * Dispara uma varredura do mercado na hora, sem esperar pelo próximo ciclo
 * do cron. O aviso de "a processar" cobre a página inteira (ver
 * ProcessingOverlay) — importante para quem não é técnico perceber que algo
 * está mesmo a acontecer, não que o botão está avariado.
 */
export function RefreshButton() {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  function handleClick() {
    setLastResult(null);
    startTransition(async () => {
      try {
        const result = await refreshScanAction();
        if (result.skipped) {
          setLastResult("Varredura desligada em Configurações.");
        } else if (result.meetsEntryRules) {
          setLastResult("Oportunidade encontrada — ver abaixo.");
        } else {
          setLastResult("Mercado actualizado. Sem oportunidade agora.");
        }
      } catch {
        setLastResult("Falhou a actualizar. Tenta novamente.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ProcessingOverlay show={isPending} message="A analisar o mercado..." />
      <Button variant="secondary" onClick={handleClick} disabled={isPending}>
        <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
        Actualizar agora
      </Button>
      {lastResult && !isPending ? <span className="text-xs text-[var(--muted)]">{lastResult}</span> : null}
    </div>
  );
}
