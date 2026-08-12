"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantém a página actualizada sozinha, em silêncio — o cron já procura
 * oportunidades a cada minuto, isto só vai buscar o resultado mais recente
 * sem bloquear o ecrã nem mostrar "a processar" (não há nenhum processamento
 * a acontecer aqui, só uma releitura dos dados já guardados).
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
