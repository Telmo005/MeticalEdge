import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Usado só para Auth (sessão/login) — os dados da app (schema metical_edge)
 * nunca passam por aqui, vão directo a Postgres via db/index.ts (Drizzle).
 * Ver supabase/migrations/0001_init.sql para o porquê.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll chamado a partir de Server Component — o middleware trata do refresh
          }
        },
      },
    }
  );
}
