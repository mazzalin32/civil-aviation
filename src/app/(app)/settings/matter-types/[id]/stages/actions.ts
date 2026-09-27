"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { stageTemplateSchema } from "@/lib/validation/settings";

function parse(matterTypeId: string, formData: FormData) {
  return stageTemplateSchema.safeParse({
    matterTypeId,
    name: formData.get("name"),
    description: formData.get("description"),
    allowsClosure: formData.get("allowsClosure") === "on",
    requiredFields: formData.get("requiredFields"),
  });
}

export async function createStage(matterTypeId: string, formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = parse(matterTypeId, formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { matterTypeId: mtId, description, ...rest } = parsed.data;
  const maxOrder = await db.stageTemplate.aggregate({ where: { matterTypeId: mtId }, _max: { order: true } });
  const created = await db.stageTemplate.create({
    data: { ...rest, matterTypeId: mtId, description: description || null, order: (maxOrder._max.order ?? 0) + 1 },
  });
  await writeAudit({ userId: admin.id, action: "setting.stage.create", entity: "StageTemplate", entityId: created.id, after: created });
  revalidatePath(`/settings/matter-types/${mtId}/stages`);
}

export async function updateStage(matterTypeId: string, formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const parsed = parse(matterTypeId, formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { matterTypeId: mtId, description, ...rest } = parsed.data;
  const before = await db.stageTemplate.findUnique({ where: { id } });
  const updated = await db.stageTemplate.update({ where: { id }, data: { ...rest, description: description || null } });
  await writeAudit({ userId: admin.id, action: "setting.stage.update", entity: "StageTemplate", entityId: id, before, after: updated });
  revalidatePath(`/settings/matter-types/${mtId}/stages`);
}

export async function toggleStageActive(matterTypeId: string, id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  const before = await db.stageTemplate.findUnique({ where: { id } });
  const updated = await db.stageTemplate.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "setting.stage.reactivate" : "setting.stage.deactivate",
    entity: "StageTemplate",
    entityId: id,
    before,
    after: updated,
  });
  revalidatePath(`/settings/matter-types/${matterTypeId}/stages`);
}

/** Real delete — safe until Phase 5 adds matters sitting on a stage. Deactivate is the everyday tool. */
export async function deleteStage(matterTypeId: string, id: string) {
  const admin = await requireRole("ADMIN");
  const before = await db.stageTemplate.findUnique({ where: { id } });
  if (!before) return;
  await db.stageTemplate.delete({ where: { id } });
  await writeAudit({ userId: admin.id, action: "setting.stage.delete", entity: "StageTemplate", entityId: id, before });
  revalidatePath(`/settings/matter-types/${matterTypeId}/stages`);
}

export async function moveStage(matterTypeId: string, id: string, direction: "up" | "down") {
  const admin = await requireRole("ADMIN");
  const items = await db.stageTemplate.findMany({ where: { matterTypeId }, orderBy: { order: "asc" } });
  const index = items.findIndex((s) => s.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= items.length) return;

  const a = items[index];
  const b = items[swapWith];
  await db.$transaction([
    db.stageTemplate.update({ where: { id: a.id }, data: { order: b.order } }),
    db.stageTemplate.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  await writeAudit({ userId: admin.id, action: "setting.stage.reorder", entity: "StageTemplate", entityId: id });
  revalidatePath(`/settings/matter-types/${matterTypeId}/stages`);
}
