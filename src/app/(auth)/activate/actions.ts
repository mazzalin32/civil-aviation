"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { afterSuccessfulAttempt } from "@/lib/lockout";
import { newPasswordSchema } from "@/lib/validation/auth";

export type ActivateState = { error?: string; fieldErrors?: Record<string, string> };

const INVALID_LINK = "This link is invalid or has expired. Request a new one.";

export async function activateAction(_prev: ActivateState, formData: FormData): Promise<ActivateState> {
  const token = String(formData.get("token") || "");
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }
  if (!token) return { error: INVALID_LINK };

  // Read (not consume) the token ourselves first: resetPassword's own success response
  // doesn't hand back the email, and we need it to sign the user straight in afterwards.
  const verification = await db.verification.findFirst({ where: { identifier: `reset-password:${token}` } });
  if (!verification || verification.expiresAt < new Date()) return { error: INVALID_LINK };
  const pendingUser = await db.user.findUnique({ where: { id: verification.value }, select: { id: true, email: true, isActive: true } });
  if (!pendingUser || !pendingUser.isActive) return { error: INVALID_LINK };

  const hdrs = await headers();
  try {
    await auth.api.resetPassword({ body: { token, newPassword: parsed.data.password }, headers: hdrs, asResponse: false });
  } catch {
    return { error: INVALID_LINK };
  }

  await db.user.update({ where: { id: pendingUser.id }, data: afterSuccessfulAttempt() });
  await writeAudit({ userId: pendingUser.id, action: "user.password.activated", entity: "User", entityId: pendingUser.id, ip: hdrs.get("x-forwarded-for") ?? undefined });

  // The password is already set at this point. If the automatic sign-in fails for any reason,
  // send them to the login page rather than showing an error for a step that succeeded.
  let result: Awaited<ReturnType<typeof auth.api.signInEmail>>;
  try {
    result = await auth.api.signInEmail({
      body: { email: pendingUser.email, password: parsed.data.password, rememberMe: false },
      headers: hdrs,
      asResponse: false,
    });
  } catch {
    redirect("/login");
  }
  const needsTwoFactor = "twoFactorRedirect" in result && result.twoFactorRedirect === true;
  if (needsTwoFactor) redirect("/2fa");
  await db.user.update({ where: { id: pendingUser.id }, data: { lastLoginAt: new Date() } });
  redirect("/");
}
