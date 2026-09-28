"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMatterAccess } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { taskSchema, naSchema } from "@/lib/validation/calendar";

type ActionResult = { error?: string } | void;

export async function addTask(raw: unknown): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, title, assigneeId, dueAt } = parsed.data;
  const user = await requireMatterAccess(matterId);

  const task = await db.task.create({ data: { matterId, title, assigneeId, dueAt: new Date(dueAt), createdById: user.id } });
  await writeAudit({ userId: user.id, action: "task.add", entity: "Task", entityId: task.id, after: { title } });
  revalidatePath(`/cases/${matterId}`);
}

export async function completeTask(matterId: string, id: string): Promise<ActionResult> {
  const user = await requireMatterAccess(matterId);
  await db.task.update({ where: { id }, data: { status: "DONE", doneAt: new Date() } });
  await writeAudit({ userId: user.id, action: "task.complete", entity: "Task", entityId: id });
  revalidatePath(`/cases/${matterId}`);
}

export async function reopenTask(matterId: string, id: string): Promise<ActionResult> {
  const user = await requireMatterAccess(matterId);
  await db.task.update({ where: { id }, data: { status: "OPEN", doneAt: null, naReason: null } });
  await writeAudit({ userId: user.id, action: "task.reopen", entity: "Task", entityId: id });
  revalidatePath(`/cases/${matterId}`);
}

export async function markTaskNotApplicable(matterId: string, id: string, raw: unknown): Promise<ActionResult> {
  const parsed = naSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Say why." };
  const user = await requireMatterAccess(matterId);
  await db.task.update({ where: { id }, data: { status: "NA", naReason: parsed.data.reason } });
  await writeAudit({ userId: user.id, action: "task.na", entity: "Task", entityId: id, after: { reason: parsed.data.reason } });
  revalidatePath(`/cases/${matterId}`);
}

export async function deleteTask(matterId: string, id: string): Promise<ActionResult> {
  const user = await requireMatterAccess(matterId);
  await db.task.delete({ where: { id } });
  await writeAudit({ userId: user.id, action: "task.delete", entity: "Task", entityId: id });
  revalidatePath(`/cases/${matterId}`);
}
