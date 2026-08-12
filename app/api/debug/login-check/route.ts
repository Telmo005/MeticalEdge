import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

/**
 * Rota temporária de diagnóstico — tenta um login real, do lado do
 * servidor, com as credenciais de teste conhecidas, para isolar se o
 * problema é mesmo a configuração do Supabase em produção ou outra coisa
 * (ex.: o que está a ser submetido no browser). Não usa cookies/sessão —
 * só reporta o resultado bruto da chamada. Apagar depois de resolver.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "env vars em falta", hasUrl: !!url, hasAnonKey: !!anonKey });
  }

  const supabase = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: "telmo.sigauquejr@mail.com",
    password: "123456",
  });

  if (error) {
    return NextResponse.json({
      ok: false,
      message: error.message,
      status: error.status ?? null,
      name: error.name,
      code: "code" in error ? (error as { code?: string }).code : null,
    });
  }

  return NextResponse.json({
    ok: true,
    userId: data.user?.id,
    email: data.user?.email,
    emailConfirmedAt: data.user?.email_confirmed_at,
  });
}
