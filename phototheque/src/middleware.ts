import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/token";
import { ADMIN_PAGE_PREFIXES, AUTHENTICATED_PAGE_PREFIXES, homePathFor } from "@/lib/auth/roles";

/**
 * Première barrière (Edge) pour les PAGES : redirige les visiteurs non
 * connectés et empêche un USER d'ouvrir une page ADMIN. Les vraies
 * vérifications d'autorisation sont refaites côté serveur dans chaque page
 * et chaque route API (`requirePagePermission`, `withAuth`).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const matches = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? homePathFor(session.role) : "/login", request.url));
  }
  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL(homePathFor(session.role), request.url)) : NextResponse.next();
  }
  if (AUTHENTICATED_PAGE_PREFIXES.some(matches) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && session.role !== "ADMIN" && ADMIN_PAGE_PREFIXES.some(matches)) {
    return NextResponse.redirect(new URL(homePathFor(session.role), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/import/:path*", "/dashboard/:path*", "/phototheque/:path*", "/categories/:path*", "/parametres/:path*"],
};
