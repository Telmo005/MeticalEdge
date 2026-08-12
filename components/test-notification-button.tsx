"use client";

import { useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { sendTestNotificationAction } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";

export function TestNotificationButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const r = await sendTestNotificationAction();

      const parts = [r.pushOk ? "push: enviado" : `push: falhou (${r.pushError})`];
      if (r.smsAttempted) {
        parts.push(r.smsOk ? "SMS: enviado" : `SMS: falhou (${r.smsError})`);
      }
      setResult(parts.join(" · "));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <ProcessingOverlay show={isPending} message="A enviar notificação de teste..." />
      <Button variant="secondary" onClick={handleClick} disabled={isPending} className="self-start">
        <BellRing className="h-4 w-4" />
        Testar notificações
      </Button>
      {result ? <p className="text-xs text-[var(--muted)]">{result}</p> : null}
    </div>
  );
}
