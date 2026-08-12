import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// App mono-utilizador: tudo fica protegido por omissão, excepto estas.
const PUBLIC_ROUTES = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/cron/* tem a própria autenticação (CRON_SECRET) — não passa pelo
  // gate de sessão Supabase.
  if (pathname.startsWith("/api/cron/")) {
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
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.json).*)",
  ],
};
