import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * O middleware já bloqueia páginas para visitantes anónimos, mas server
 * actions são chamadas directamente pelo cliente e não passam pelo
 * middleware de rota — por isso cada action que muta dados chama isto
 * primeiro. Lança em vez de devolver null: uma action nunca deve continuar
 * silenciosamente sem sessão.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}
