"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { otpCodeSchema } from "@/lib/validation/auth";

export type SendResult = { ok: true } | { ok: false; error: string };

/** Emails the first code. Also used to resend — each call issues a fresh code. */
export async function sendTwoFactorSetupOtp(): Promise<SendResult> {
  try {
    await auth.api.sendTwoFactorOTP({ headers: await headers(), asResponse: false });
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't send the code. Try again in a moment." };
  }
}

export type ConfirmSetupResult = { ok: true } | { ok: false; error: string };

/** Entering the emailed code both proves it's deliverable and turns on 2FA in one step
 *  (Better Auth's own verifyTwoFactorOTP flips twoFactorEnabled on first success). */
export async function confirmTwoFactorSetup(formData: FormData): Promise<ConfirmSetupResult> {
  const parsed = otpCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code." };

  // Read the user BEFORE calling verifyTwoFactorOTP: on first confirmation it rotates the
  // session (old token deleted, new one issued), so a getCurrentUser() afterwards would
  // read the now-stale incoming request and find nothing.
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };

  try {
    await auth.api.verifyTwoFactorOTP({ body: { code: parsed.data.code }, headers: await headers(), asResponse: false });
    await db.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date() } });
    await writeAudit({ userId: user.id, action: "user.2fa.enabled", entity: "User", entityId: user.id });
    return { ok: true };
  } catch {
    return { ok: false, error: "That code didn't match. Check your email and try again, or resend." };
  }
}
