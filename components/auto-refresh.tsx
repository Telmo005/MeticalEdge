"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantém a página actualizada sozinha, em silêncio — o cron já procura
 * oportunidades a cada minuto, isto só vai buscar o resultado mais recente
 * sem bloquear o ecrã nem mostrar "a processar" (não há nenhum processamento
 * a acontecer aqui, só uma releitura dos dados já guardados).
 *
 * Só actualiza com a aba visível — um `router.refresh()` ainda em curso em
 * fundo pode fazer o router do Next.js esperar por ele antes de completar
 * uma navegação que entretanto tenhas pedido (ex.: sair de /oportunidades),
 * o que parece a app "presa a processar" sem motivo aparente.
 */
export function AutoRefresh({ intervalMs = 90_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
