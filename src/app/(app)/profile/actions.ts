"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { digestSchema, notificationPreferenceSchema } from "@/lib/validation/profile";

type Result = { ok: true } | { error: string };

/**
 * Turns one notification type on or off for the signed-in user, per channel (spec §5.9: users can
 * mute non-critical types; hearing, deadline and security alerts can't be muted). Only the person
 * themself can change their own preferences — the user id always comes from the session.
 */
export async function setNotificationPreference(input: unknown): Promise<Result> {
  const user = await requireRole("ADMIN", "LAWYER");
  const parsed = notificationPreferenceSchema.safeParse(input);
  if (!parsed.success) return { error: "That setting couldn't be saved." };
  const { type, channel, enabled } = parsed.data;

  const rule = await db.notificationRule.findUnique({ where: { trigger: type } });
  if (!rule) return { error: "That notification type no longer exists." };
  if (!rule.mutable) return { error: "This notification can't be turned off." };
  if (!rule.channels.includes(channel === "email" ? "EMAIL" : "IN_APP")) {
    return { error: channel === "email" ? "This notification isn't sent by email." : "This notification isn't shown in the app." };
  }

  const before = await db.notificationPreference.findUnique({ where: { userId_type: { userId: user.id, type } } });
  const after = await db.notificationPreference.upsert({
    where: { userId_type: { userId: user.id, type } },
    // No row means "on for both" (notify.ts), so a new row starts from that.
    create: { userId: user.id, type, inApp: true, email: true, [channel]: enabled },
    update: { [channel]: enabled },
  });
  await writeAudit({
    userId: user.id,
    action: "user.notificationPreference.update",
    entity: "NotificationPreference",
    entityId: `${user.id}:${type}`,
    before: before ? { inApp: before.inApp, email: before.email } : null,
    after: { inApp: after.inApp, email: after.email },
  });
  revalidatePath("/profile");
  return { ok: true };
}

/** The optional 7:00 AM "Your day" email (spec §5.9) — sent by the job runner (src/lib/jobs/digest.ts). */
export async function setDigestEnabled(input: unknown): Promise<Result> {
  const user = await requireRole("ADMIN", "LAWYER");
  const parsed = digestSchema.safeParse(input);
  if (!parsed.success) return { error: "That setting couldn't be saved." };

  const before = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { digestEnabled: true } });
  await db.user.update({ where: { id: user.id }, data: { digestEnabled: parsed.data.enabled } });
  await writeAudit({
    userId: user.id,
    action: "user.digest.update",
    entity: "User",
    entityId: user.id,
    before: { digestEnabled: before.digestEnabled },
    after: { digestEnabled: parsed.data.enabled },
  });
  revalidatePath("/profile");
  return { ok: true };
}
