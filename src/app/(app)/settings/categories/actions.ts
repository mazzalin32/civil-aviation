"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { categorySchema } from "@/lib/validation/settings";

async function reload() {
  revalidatePath("/settings/categories");
}

export async function createCategory(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = categorySchema.safeParse({ name: formData.get("name"), color: formData.get("color") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const maxOrder = await db.category.aggregate({ _max: { order: true } });
  const created = await db.category.create({ data: { ...parsed.data, order: (maxOrder._max.order ?? 0) + 1 } });
  await writeAudit({ userId: admin.id, action: "setting.category.create", entity: "Category", entityId: created.id, after: created });
  await reload();
}

export async function updateCategory(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const parsed = categorySchema.safeParse({ name: formData.get("name"), color: formData.get("color") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const before = await db.category.findUnique({ where: { id } });
  const updated = await db.category.update({ where: { id }, data: parsed.data });
  await writeAudit({ userId: admin.id, action: "setting.category.update", entity: "Category", entityId: id, before, after: updated });
  await reload();
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  const before = await db.category.findUnique({ where: { id } });
  const updated = await db.category.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "setting.category.reactivate" : "setting.category.deactivate",
    entity: "Category",
    entityId: id,
    before,
    after: updated,
  });
  await reload();
}

/**
 * Real delete, not soft — safe because no matter yet references a category (Phase 4
 * adds that). Once matters exist, this must check usage first and refuse if any exist
 * (spec §5.13: "hard delete only if never used"); deactivate is the everyday tool.
 */
export async function deleteCategory(id: string) {
  const admin = await requireRole("ADMIN");
  const before = await db.category.findUnique({ where: { id } });
  if (!before) return;
  try {
    await db.category.delete({ where: { id } });
  } catch {
    return { error: "Couldn't delete this category — it may have sub-categories under it. Deactivate it instead." };
  }
  await writeAudit({ userId: admin.id, action: "setting.category.delete", entity: "Category", entityId: id, before });
  await reload();
}

export async function moveCategory(id: string, direction: "up" | "down") {
  const admin = await requireRole("ADMIN");
  const items = await db.category.findMany({ orderBy: { order: "asc" } });
  const index = items.findIndex((c) => c.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= items.length) return;

  const a = items[index];
  const b = items[swapWith];
  await db.$transaction([
    db.category.update({ where: { id: a.id }, data: { order: b.order } }),
    db.category.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  await writeAudit({ userId: admin.id, action: "setting.category.reorder", entity: "Category", entityId: id });
  await reload();
}
