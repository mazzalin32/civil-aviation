"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { matterTypeSchema } from "@/lib/validation/settings";

async function reload() {
  revalidatePath("/settings/matter-types");
}

function parse(formData: FormData) {
  return matterTypeSchema.safeParse({
    name: formData.get("name"),
    referencePrefix: formData.get("referencePrefix"),
    closurePolicy: formData.get("closurePolicy"),
    isSubProcess: formData.get("isSubProcess") === "on",
  });
}

export async function createMatterType(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { referencePrefix, ...rest } = parsed.data;
  const maxOrder = await db.matterType.aggregate({ _max: { order: true } });
  const created = await db.matterType.create({
    data: { ...rest, referencePrefix: referencePrefix || null, order: (maxOrder._max.order ?? 0) + 1 },
  });
  await writeAudit({ userId: admin.id, action: "setting.matterType.create", entity: "MatterType", entityId: created.id, after: created });
  await reload();
}

export async function updateMatterType(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { referencePrefix, ...rest } = parsed.data;
  const before = await db.matterType.findUnique({ where: { id } });
  const updated = await db.matterType.update({ where: { id }, data: { ...rest, referencePrefix: referencePrefix || null } });
  await writeAudit({ userId: admin.id, action: "setting.matterType.update", entity: "MatterType", entityId: id, before, after: updated });
  await reload();
}

export async function toggleMatterTypeActive(id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  const before = await db.matterType.findUnique({ where: { id } });
  const updated = await db.matterType.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "setting.matterType.reactivate" : "setting.matterType.deactivate",
    entity: "MatterType",
    entityId: id,
    before,
    after: updated,
  });
  await reload();
}
