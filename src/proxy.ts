import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Route protection (Next 16 renamed `middleware.ts` to `proxy.ts`; behaviour is the
 * same). Runs on the Node.js runtime by default, so it can call the database directly.
 *
 * Two onboarding gates apply to every session before it reaches the app:
 *   1. mustChangePassword  — the seeded Admin's temporary password (spec §5.1)
 *   2. !twoFactorEnabled   — mandatory 2FA, including after an Admin-triggered reset (FLOWS §19)
 * Both redirect to their own page until satisfied, so a partly-onboarded session can
 * never reach case data. Both are switched off by REQUIRE_PASSWORD_CHANGE=false /
 * REQUIRE_2FA=false while testing — spec requires both on every account, so these must be
 * true again before go-live.
 */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/activate", "/2fa"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, mustChangePassword: true, twoFactorEnabled: true },
  });
  if (!user || !user.isActive) return NextResponse.redirect(new URL("/login", request.url));

  // API routes get a session check but never an HTML redirect — a fetch caller can't
  // follow one anyway, and every action file re-checks the same flags itself.
  if (!pathname.startsWith("/api/")) {
    if (env.REQUIRE_PASSWORD_CHANGE && user.mustChangePassword && pathname !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", request.url));
    }
    if (env.REQUIRE_2FA && !user.mustChangePassword && !user.twoFactorEnabled && pathname !== "/2fa/setup") {
      return NextResponse.redirect(new URL("/2fa/setup", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
