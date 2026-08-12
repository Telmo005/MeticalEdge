import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

/**
 * Rota temporária de diagnóstico — só revela SE as variáveis estão
 * definidas e um pedaço curto delas (nunca o segredo inteiro), para
 * confirmar o que o deployment em produção realmente tem carregado.
 * Protegida pelo mesmo CRON_SECRET (é o único segredo que já sei que
 * chega correctamente ao deployment, porque o cron já corre). Apagar
 * depois de resolver o login em produção.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let urlHost: string | null = null;
  let urlParseError: string | null = null;
  if (url) {
    try {
      urlHost = new URL(url).host;
    } catch (e) {
      urlParseError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV,
    supabaseUrlRaw_len: url?.length ?? 0,
    supabaseUrlRaw_first5: url?.slice(0, 5) ?? null,
    supabaseUrlRaw_last5: url?.slice(-5) ?? null,
    supabaseUrlHost: urlHost,
    supabaseUrlParseError: urlParseError,
    anonKeyPrefix: anonKey?.slice(0, 16) ?? null,
    anonKeyLen: anonKey?.length ?? 0,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasCronSecret: !!process.env.CRON_SECRET,
  });
}
