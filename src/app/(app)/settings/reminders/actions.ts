"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { reminderRuleSchema } from "@/lib/validation/settings";

export async function updateReminderRule(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = reminderRuleSchema.safeParse({
    id: formData.get("id"),
    offsets: formData.get("offsets"),
    channels: formData.getAll("channels"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  // "mutable" is about whether a lawyer can mute this for themselves — the Admin can
  // always edit any rule's schedule (spec §5.13), muted or not.
  const before = await db.notificationRule.findUnique({ where: { id: parsed.data.id } });
  const updated = await db.notificationRule.update({
    where: { id: parsed.data.id },
    data: { offsets: parsed.data.offsets, channels: parsed.data.channels },
  });
  await writeAudit({ userId: admin.id, action: "setting.reminderRule.update", entity: "NotificationRule", entityId: updated.id, before, after: updated });
  revalidatePath("/settings/reminders");
}
