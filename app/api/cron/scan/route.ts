import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runMarketScan } from "@/lib/p2p/scan";

export const maxDuration = 60;

/**
 * Varredura periódica do mercado USDT/MZN — chamada por um scheduler externo
 * (cron-job.org, mesmo padrão do Duelo) a cada N minutos, autenticada por
 * CRON_SECRET. A lógica em si vive em lib/p2p/scan.ts (partilhada com o
 * botão de "actualizar agora" do painel, ver lib/actions/scan.ts).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runMarketScan();
  return NextResponse.json(result);
}
