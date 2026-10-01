import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Route protection (Next 16 renamed `middleware.ts` to `proxy.ts`; behaviour is the same).
 *
 * This runs on EVERY request, so for pages it is deliberately only a cheap cookie check — no
 * database round trips. The authoritative checks (is the session still valid, is the account
 * active, the forced password change and mandatory 2FA gates) happen once per request in the
 * (app) layout and in the permission helpers (src/lib/authz.ts), which already load the user.
 * API routes get the full session + active-account check here because they have no layout.
 */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/activate", "/2fa"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (!pathname.startsWith("/api/")) {
    if (!getSessionCookie(request)) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { isActive: true, deletedAt: true } });
  if (!user || !user.isActive || user.deletedAt) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  // Static files in /public (logo, fonts, etc.) never carry a session — without this,
  // an unauthenticated <img> request for one gets 307'd to /login (found via the broken
  // logo on the login page itself, which obviously can't be behind auth).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$).*)"],
};
