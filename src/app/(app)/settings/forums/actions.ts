"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { forumSchema } from "@/lib/validation/settings";

async function reload() {
  revalidatePath("/settings/forums");
}

function parse(formData: FormData) {
  return forumSchema.safeParse({
    name: formData.get("name"),
    level: formData.get("level"),
    division: formData.get("division"),
    location: formData.get("location"),
  });
}

export async function createForum(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { division, location, ...rest } = parsed.data;
  const maxOrder = await db.forum.aggregate({ _max: { order: true } });
  const created = await db.forum.create({
    data: { ...rest, division: division || null, location: location || null, order: (maxOrder._max.order ?? 0) + 1 },
  });
  await writeAudit({ userId: admin.id, action: "setting.forum.create", entity: "Forum", entityId: created.id, after: created });
  await reload();
}

export async function updateForum(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { division, location, ...rest } = parsed.data;
  const before = await db.forum.findUnique({ where: { id } });
  const updated = await db.forum.update({ where: { id }, data: { ...rest, division: division || null, location: location || null } });
  await writeAudit({ userId: admin.id, action: "setting.forum.update", entity: "Forum", entityId: id, before, after: updated });
  await reload();
}

export async function toggleForumActive(id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  const before = await db.forum.findUnique({ where: { id } });
  const updated = await db.forum.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "setting.forum.reactivate" : "setting.forum.deactivate",
    entity: "Forum",
    entityId: id,
    before,
    after: updated,
  });
  await reload();
}

/** Real delete — safe until Phase 4 adds matters that reference a forum. Deactivate is the everyday tool. */
export async function deleteForum(id: string) {
  const admin = await requireRole("ADMIN");
  const before = await db.forum.findUnique({ where: { id } });
  if (!before) return;
  await db.forum.delete({ where: { id } });
  await writeAudit({ userId: admin.id, action: "setting.forum.delete", entity: "Forum", entityId: id, before });
  await reload();
}

export async function moveForum(id: string, direction: "up" | "down") {
  const admin = await requireRole("ADMIN");
  const items = await db.forum.findMany({ orderBy: { order: "asc" } });
  const index = items.findIndex((f) => f.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= items.length) return;

  const a = items[index];
  const b = items[swapWith];
  await db.$transaction([
    db.forum.update({ where: { id: a.id }, data: { order: b.order } }),
    db.forum.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  await writeAudit({ userId: admin.id, action: "setting.forum.reorder", entity: "Forum", entityId: id });
  await reload();
}
