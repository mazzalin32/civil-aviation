"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { outcomeSchema } from "@/lib/validation/settings";

async function reload() {
  revalidatePath("/settings/outcomes");
}

export async function createOutcome(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = outcomeSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const maxOrder = await db.outcome.aggregate({ _max: { order: true } });
  const created = await db.outcome.create({ data: { name: parsed.data.name, order: (maxOrder._max.order ?? 0) + 1 } });
  await writeAudit({ userId: admin.id, action: "setting.outcome.create", entity: "Outcome", entityId: created.id, after: created });
  await reload();
}

export async function updateOutcome(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const parsed = outcomeSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const before = await db.outcome.findUnique({ where: { id } });
  const updated = await db.outcome.update({ where: { id }, data: { name: parsed.data.name } });
  await writeAudit({ userId: admin.id, action: "setting.outcome.update", entity: "Outcome", entityId: id, before, after: updated });
  await reload();
}

export async function toggleOutcomeActive(id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  const before = await db.outcome.findUnique({ where: { id } });
  const updated = await db.outcome.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "setting.outcome.reactivate" : "setting.outcome.deactivate",
    entity: "Outcome",
    entityId: id,
    before,
    after: updated,
  });
  await reload();
}

export async function moveOutcome(id: string, direction: "up" | "down") {
  const admin = await requireRole("ADMIN");
  const items = await db.outcome.findMany({ orderBy: { order: "asc" } });
  const index = items.findIndex((x) => x.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= items.length) return;
  const a = items[index];
  const b = items[swapWith];
  await db.$transaction([
    db.outcome.update({ where: { id: a.id }, data: { order: b.order } }),
    db.outcome.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  await writeAudit({ userId: admin.id, action: "setting.outcome.reorder", entity: "Outcome", entityId: id });
  await reload();
}
