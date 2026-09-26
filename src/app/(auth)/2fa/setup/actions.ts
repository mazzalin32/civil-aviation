"use server";

import { headers } from "next/headers";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { totpCodeSchema, twoFactorSetupSchema } from "@/lib/validation/auth";

export type BeginSetupResult = { ok: true; qrDataUrl: string; secretUri: string; backupCodes: string[] } | { ok: false; error: string };

/** Step 1: confirm the current password, then provision a TOTP secret + backup codes. */
export async function beginTwoFactorSetup(formData: FormData): Promise<BeginSetupResult> {
  const parsed = twoFactorSetupSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter your password." };

  try {
    const result = await auth.api.enableTwoFactor({
      body: { password: parsed.data.password, method: "totp", issuer: "CAA Legal" },
      headers: await headers(),
      asResponse: false,
    });
    if (result.method !== "totp") return { ok: false, error: "Unexpected response setting up 2FA." };
    const qrDataUrl = await QRCode.toDataURL(result.totpURI, { margin: 1, width: 220 });
    return { ok: true, qrDataUrl, secretUri: result.totpURI, backupCodes: result.backupCodes };
  } catch {
    return { ok: false, error: "That password is incorrect." };
  }
}

export type ConfirmSetupResult = { ok: true } | { ok: false; error: string };

/** Step 2: prove the authenticator app actually works before letting the user past the gate. */
export async function confirmTwoFactorSetup(formData: FormData): Promise<ConfirmSetupResult> {
  const parsed = totpCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code." };

  // Read the user BEFORE calling verifyTOTP: on first confirmation it rotates the
  // session (new cookie out, old token deleted), so a getCurrentUser() afterwards
  // would read the now-stale incoming request and find nothing.
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };

  try {
    await auth.api.verifyTOTP({ body: { code: parsed.data.code }, headers: await headers(), asResponse: false });
    await db.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date() } });
    await writeAudit({ userId: user.id, action: "user.2fa.enabled", entity: "User", entityId: user.id });
    return { ok: true };
  } catch {
    return { ok: false, error: "That code didn't match. Check your authenticator app and try again." };
  }
}
