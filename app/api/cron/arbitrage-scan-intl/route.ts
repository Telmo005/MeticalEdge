import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runIntlArbitrageScan } from "@/lib/p2p/intl/scan";

export const maxDuration = 60;

/**
 * Varredura periódica de arbitragem P2P internacional (Fase 1 — validação
 * de mercado, ver .planning/PHASE1_PLAN.md). Independente de
 * /api/cron/scan (motor USDT/MZN em produção) — mesma autenticação por
 * CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runIntlArbitrageScan();
  return NextResponse.json({ results });
}
