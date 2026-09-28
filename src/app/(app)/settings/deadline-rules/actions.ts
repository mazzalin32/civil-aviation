"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { deadlineRuleSchema } from "@/lib/validation/settings";

async function reload() {
  revalidatePath("/settings/deadline-rules");
}

function parse(formData: FormData) {
  return deadlineRuleSchema.safeParse({
    name: formData.get("name"),
    triggerEventTypeId: formData.get("triggerEventTypeId"),
    offsetDays: formData.get("offsetDays"),
    isCritical: formData.get("isCritical"),
  });
}

export async function createDeadlineRule(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { name, ...rest } = parsed.data;
  const created = await db.deadlineRule.create({ data: { title: name, ...rest } });
  await writeAudit({ userId: admin.id, action: "setting.deadlineRule.create", entity: "DeadlineRule", entityId: created.id, after: created });
  await reload();
}

export async function updateDeadlineRule(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { name, ...rest } = parsed.data;
  const before = await db.deadlineRule.findUnique({ where: { id } });
  const updated = await db.deadlineRule.update({ where: { id }, data: { title: name, ...rest } });
  await writeAudit({ userId: admin.id, action: "setting.deadlineRule.update", entity: "DeadlineRule", entityId: id, before, after: updated });
  await reload();
}

export async function toggleDeadlineRuleActive(id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  const before = await db.deadlineRule.findUnique({ where: { id } });
  const updated = await db.deadlineRule.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "setting.deadlineRule.reactivate" : "setting.deadlineRule.deactivate",
    entity: "DeadlineRule",
    entityId: id,
    before,
    after: updated,
  });
  await reload();
}

/** Real delete — safe, nothing references a DeadlineRule row itself (it's read by title/offset at the moment a deadline is suggested, never joined to). */
export async function deleteDeadlineRule(id: string) {
  const admin = await requireRole("ADMIN");
  const before = await db.deadlineRule.findUnique({ where: { id } });
  if (!before) return;
  await db.deadlineRule.delete({ where: { id } });
  await writeAudit({ userId: admin.id, action: "setting.deadlineRule.delete", entity: "DeadlineRule", entityId: id, before });
  await reload();
}
