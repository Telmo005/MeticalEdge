"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { runMarketScan } from "@/lib/p2p/scan";

/** Botão "Actualizar agora" do painel — mesma varredura do cron, mas
 *  disparada manualmente por um utilizador autenticado em vez do
 *  CRON_SECRET. Útil quando não se quer esperar pelo próximo ciclo
 *  agendado. */
export async function refreshScanAction() {
  await requireUser();
  const result = await runMarketScan();

  revalidatePath("/");
  revalidatePath("/livro");
  revalidatePath("/simulacao");

  return result;
}
