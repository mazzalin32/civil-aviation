"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { sendAccountLockedEmail } from "@/lib/mailer";
import { afterFailedAttempt, afterSuccessfulAttempt, isLocked, minutesRemaining } from "@/lib/lockout";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = { error?: string; fieldErrors?: Record<string, string> };

const GENERIC_ERROR = "Incorrect email or password.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }
  const { email, password } = parsed.data;
  const next = String(formData.get("next") || "/");
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? undefined;

  // Fetching first (rather than letting Better Auth do it alone) is what lets us apply
  // our own lockout policy — Better Auth has no built-in lockout concept.
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return { error: GENERIC_ERROR };

  if (isLocked(user)) {
    return { error: `This account is locked. Try again in ${minutesRemaining(user.lockedUntil!)} minute(s).` };
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password, rememberMe: false },
      headers: hdrs,
      asResponse: false,
    });

    // The twoFactor plugin's after-hook replaces the normal response with this shape
    // instead of creating a session — see the two-factor plugin's `hooks.after`.
    const needsTwoFactor = "twoFactorRedirect" in result && result.twoFactorRedirect === true;

    await db.user.update({ where: { id: user.id }, data: afterSuccessfulAttempt() });
    await writeAudit({ userId: user.id, action: needsTwoFactor ? "user.login.password_ok" : "user.login", entity: "User", entityId: user.id, ip });

    if (needsTwoFactor) redirect(`/2fa?next=${encodeURIComponent(next)}`);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    redirect(next);
  } catch (err) {
    if (isRedirectError(err)) throw err;

    const updated = afterFailedAttempt(user);
    await db.user.update({ where: { id: user.id }, data: updated });
    await writeAudit({ userId: user.id, action: "user.login.failed", entity: "User", entityId: user.id, ip });

    if (updated.lockedUntil) {
      await writeAudit({ userId: user.id, action: "user.login.locked", entity: "User", entityId: user.id, ip });
      const admins = await db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { email: true } });
      await Promise.all(admins.map((a) => sendAccountLockedEmail(a.email, user.name, user.email)));
      return { error: `Too many failed attempts. This account is locked for ${minutesRemaining(updated.lockedUntil)} minutes.` };
    }
    return { error: GENERIC_ERROR };
  }
}

/** redirect() throws internally; never treat that as a real error. */
function isRedirectError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err && String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}
