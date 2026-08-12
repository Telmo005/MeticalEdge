import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// App mono-utilizador: tudo fica protegido por omissão, excepto estas.
const PUBLIC_ROUTES = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/cron/* e /api/debug/* têm a própria autenticação (CRON_SECRET) —
  // não passam pelo gate de sessão Supabase.
  if (pathname.startsWith("/api/cron/") || pathname.startsWith("/api/debug/")) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // manifest.webmanifest (não manifest.json — é o nome real que o Next
    // gera a partir de app/manifest.ts) e sw.js têm de ficar sempre
    // acessíveis sem sessão, senão o Android nunca considera a app
    // instalável (avalia isto antes/independentemente do login).
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js).*)",
  ],
};
