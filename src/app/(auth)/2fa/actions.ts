"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { sendTwoFactorOtpOnce } from "@/lib/two-factor-otp";
import { afterSuccessfulAttempt } from "@/lib/lockout";
import { otpCodeSchema } from "@/lib/validation/auth";

export type TwoFactorState = { error?: string };

export async function verifyTwoFactorAction(_prev: TwoFactorState, formData: FormData): Promise<TwoFactorState> {
  const next = String(formData.get("next") || "/");
  const hdrs = await headers();

  const parsed = otpCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid code." };

  try {
    const result = await auth.api.verifyTwoFactorOTP({ body: { code: parsed.data.code }, headers: hdrs, asResponse: false });

    // The plugin's own TwoFactor.failedVerificationCount/lockedUntil guards OTP
    // brute-forcing; our failedLoginCount is the whole-login counter (spec §9).
    await db.user.update({ where: { id: result.user.id }, data: { ...afterSuccessfulAttempt(), lastLoginAt: new Date() } });
    await writeAudit({ userId: result.user.id, action: "user.login", entity: "User", entityId: result.user.id, ip: hdrs.get("x-forwarded-for") ?? undefined });
    redirect(next.startsWith("/") ? next : "/");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: messageFor(err) };
  }
}

export type ResendResult = { ok: true } | { ok: false; error: string };

export async function resendTwoFactorOtp(): Promise<ResendResult> {
  try {
    await sendTwoFactorOtpOnce({ force: true }); // explicit resend — the form enforces its own cooldown
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't send a new code. Try again in a moment." };
  }
}

function messageFor(err: unknown): string {
  const message = err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message) : "";
  if (/locked/i.test(message)) return "Too many incorrect codes. Wait a few minutes and try again.";
  if (/expired/i.test(message)) return "That code has expired. Request a new one.";
  return "That code didn't work. Check your email and try again.";
}

function isRedirectError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err && String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}
