"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { documentFolderSchema, eventTypeSchema } from "@/lib/validation/settings";

async function reload() {
  revalidatePath("/settings/types");
}

// --- Event types ---

export async function createEventType(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = eventTypeSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const maxOrder = await db.eventType.aggregate({ _max: { order: true } });
  const created = await db.eventType.create({ data: { name: parsed.data.name, order: (maxOrder._max.order ?? 0) + 1 } });
  await writeAudit({ userId: admin.id, action: "setting.eventType.create", entity: "EventType", entityId: created.id, after: created });
  await reload();
}

export async function updateEventType(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const parsed = eventTypeSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const before = await db.eventType.findUnique({ where: { id } });
  const updated = await db.eventType.update({ where: { id }, data: { name: parsed.data.name } });
  await writeAudit({ userId: admin.id, action: "setting.eventType.update", entity: "EventType", entityId: id, before, after: updated });
  await reload();
}

export async function toggleEventTypeActive(id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  const before = await db.eventType.findUnique({ where: { id } });
  const updated = await db.eventType.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "setting.eventType.reactivate" : "setting.eventType.deactivate",
    entity: "EventType",
    entityId: id,
    before,
    after: updated,
  });
  await reload();
}

/** Real delete — safe until Phase 5 adds timeline events that reference a type. Deactivate is the everyday tool. */
export async function deleteEventType(id: string) {
  const admin = await requireRole("ADMIN");
  const before = await db.eventType.findUnique({ where: { id } });
  if (!before) return;
  await db.eventType.delete({ where: { id } });
  await writeAudit({ userId: admin.id, action: "setting.eventType.delete", entity: "EventType", entityId: id, before });
  await reload();
}

export async function moveEventType(id: string, direction: "up" | "down") {
  const admin = await requireRole("ADMIN");
  const items = await db.eventType.findMany({ orderBy: { order: "asc" } });
  const index = items.findIndex((x) => x.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= items.length) return;
  const a = items[index];
  const b = items[swapWith];
  await db.$transaction([
    db.eventType.update({ where: { id: a.id }, data: { order: b.order } }),
    db.eventType.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  await writeAudit({ userId: admin.id, action: "setting.eventType.reorder", entity: "EventType", entityId: id });
  await reload();
}

// --- Document folders ---

export async function createDocumentFolder(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = documentFolderSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const maxOrder = await db.documentFolder.aggregate({ _max: { order: true } });
  const created = await db.documentFolder.create({ data: { name: parsed.data.name, order: (maxOrder._max.order ?? 0) + 1 } });
  await writeAudit({ userId: admin.id, action: "setting.documentFolder.create", entity: "DocumentFolder", entityId: created.id, after: created });
  await reload();
}

export async function updateDocumentFolder(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const parsed = documentFolderSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const before = await db.documentFolder.findUnique({ where: { id } });
  const updated = await db.documentFolder.update({ where: { id }, data: { name: parsed.data.name } });
  await writeAudit({ userId: admin.id, action: "setting.documentFolder.update", entity: "DocumentFolder", entityId: id, before, after: updated });
  await reload();
}

export async function toggleDocumentFolderActive(id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  const before = await db.documentFolder.findUnique({ where: { id } });
  const updated = await db.documentFolder.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "setting.documentFolder.reactivate" : "setting.documentFolder.deactivate",
    entity: "DocumentFolder",
    entityId: id,
    before,
    after: updated,
  });
  await reload();
}

/** Real delete — safe until Phase 6 adds documents that reference a folder. Deactivate is the everyday tool. */
export async function deleteDocumentFolder(id: string) {
  const admin = await requireRole("ADMIN");
  const before = await db.documentFolder.findUnique({ where: { id } });
  if (!before) return;
  await db.documentFolder.delete({ where: { id } });
  await writeAudit({ userId: admin.id, action: "setting.documentFolder.delete", entity: "DocumentFolder", entityId: id, before });
  await reload();
}

export async function moveDocumentFolder(id: string, direction: "up" | "down") {
  const admin = await requireRole("ADMIN");
  const items = await db.documentFolder.findMany({ orderBy: { order: "asc" } });
  const index = items.findIndex((x) => x.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= items.length) return;
  const a = items[index];
  const b = items[swapWith];
  await db.$transaction([
    db.documentFolder.update({ where: { id: a.id }, data: { order: b.order } }),
    db.documentFolder.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  await writeAudit({ userId: admin.id, action: "setting.documentFolder.reorder", entity: "DocumentFolder", entityId: id });
  await reload();
}
