"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { afterSuccessfulAttempt } from "@/lib/lockout";
import { backupCodeSchema, totpCodeSchema } from "@/lib/validation/auth";

export type TwoFactorState = { error?: string };

export async function verifyTwoFactorAction(_prev: TwoFactorState, formData: FormData): Promise<TwoFactorState> {
  const method = formData.get("method") === "backup" ? "backup" : "totp";
  const next = String(formData.get("next") || "/");
  const hdrs = await headers();

  const parsed = method === "backup" ? backupCodeSchema.safeParse({ code: formData.get("code") }) : totpCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid code." };

  try {
    const result =
      method === "backup"
        ? await auth.api.verifyBackupCode({ body: { code: parsed.data.code }, headers: hdrs, asResponse: false })
        : await auth.api.verifyTOTP({ body: { code: parsed.data.code }, headers: hdrs, asResponse: false });

    // The plugin's own TwoFactor.failedVerificationCount/lockedUntil guards TOTP
    // brute-forcing; our failedLoginCount is the whole-login counter (spec §9).
    await db.user.update({ where: { id: result.user.id }, data: { ...afterSuccessfulAttempt(), lastLoginAt: new Date() } });
    await writeAudit({ userId: result.user.id, action: "user.login", entity: "User", entityId: result.user.id, ip: hdrs.get("x-forwarded-for") ?? undefined });
    redirect(next.startsWith("/") ? next : "/");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: messageFor(err) };
  }
}

function messageFor(err: unknown): string {
  const message = err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message) : "";
  if (/locked/i.test(message)) return "Too many incorrect codes. Wait a few minutes and try again.";
  return "That code didn't work. Check your authenticator app and try again.";
}

function isRedirectError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err && String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}
