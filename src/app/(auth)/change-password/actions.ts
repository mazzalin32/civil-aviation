"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validation/auth";

export type ChangePasswordState = { error?: string; fieldErrors?: Record<string, string> };

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    // revokeOtherSessions: false — this request's own session stays valid so the user
    // isn't signed out mid-onboarding by their own password change.
    await auth.api.changePassword({
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.password, revokeOtherSessions: false },
      headers: await headers(),
      asResponse: false,
    });
  } catch (err) {
    // Better Auth throws for several distinct reasons here — wrong current password, but
    // also the haveIBeenPwned plugin's breach-check network call failing, or a genuinely
    // reused/compromised new password. Blaming "current password" for all of them made a
    // real failure (e.g. an outbound network hiccup) look identical to a typo, with no way
    // to tell them apart. Logging the real error and matching on its actual message instead.
    const message = err instanceof Error ? err.message : String(err);
    console.error("changePasswordAction failed:", message);
    if (/current.*password|invalid.*password/i.test(message)) {
      return { fieldErrors: { currentPassword: "That's not your current password." } };
    }
    if (/compromised|breach|pwned/i.test(message)) {
      return { fieldErrors: { password: "This password has appeared in a public data breach. Choose a different one." } };
    }
    return { error: "Couldn't change your password right now — please try again in a moment." };
  }

  await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false, passwordChangedAt: new Date() } });
  await writeAudit({ userId: user.id, action: "user.password.changed", entity: "User", entityId: user.id });
  redirect("/");
}
