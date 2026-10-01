"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireMatterAccess, requireTaskAssign, canEditMatter } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { taskSchema, naSchema } from "@/lib/validation/calendar";

type ActionResult = { error?: string } | void;

/** The task's own assignee can update its own status even off the case team; anyone else
 *  updating it needs to be Lead/Support/Admin. Assigning NEW tasks is stricter (Lead only) —
 *  see requireTaskAssign in addTask. */
async function requireTaskUpdate(matterId: string, taskId: string) {
  const user = await requireMatterAccess(matterId);
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { assigneeId: true } });
  if (task.assigneeId === user.id) return user;
  if (await canEditMatter(user.id, user.role, matterId)) return user;
  redirect("/forbidden");
}

export async function addTask(raw: unknown): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, title, assigneeId, dueAt } = parsed.data;
  // Admin or the case's Lead only — they may hand work to anyone in the department, not just the case team.
  const user = await requireTaskAssign(matterId);

  const [matter, assignee] = await Promise.all([
    db.matter.findUnique({ where: { id: matterId }, select: { reference: true, title: true, deletedAt: true } }),
    db.user.findUnique({ where: { id: assigneeId }, select: { isActive: true, deletedAt: true } }),
  ]);
  if (!matter || matter.deletedAt) return { error: "That case no longer exists." };
  if (!assignee?.isActive || assignee.deletedAt) return { error: "Choose an active person to assign this task to." };

  const task = await db.task.create({ data: { matterId, title, assigneeId, dueAt: new Date(dueAt), createdById: user.id } });
  await writeAudit({ userId: user.id, action: "task.add", entity: "Task", entityId: task.id, after: { title, assigneeId } });

  if (assigneeId !== user.id) {
    await notify({
      userId: assigneeId,
      type: "TASK_ASSIGNED",
      matterId,
      payload: { reference: matter.reference, title, dueAt },
      subject: `New task: ${title}`,
      message: `${user.name} assigned you a task on "${matter.title}" (${matter.reference}): ${title}. Due ${dueAt}.`,
      url: `/cases/${matterId}?tab=tasks`,
    });
  }
  revalidatePath(`/cases/${matterId}`);
  revalidatePath("/tasks");
}

export async function completeTask(matterId: string, id: string): Promise<ActionResult> {
  const user = await requireTaskUpdate(matterId, id);
  await db.task.update({ where: { id }, data: { status: "DONE", doneAt: new Date() } });
  await writeAudit({ userId: user.id, action: "task.complete", entity: "Task", entityId: id });
  revalidatePath(`/cases/${matterId}`);
}

export async function reopenTask(matterId: string, id: string): Promise<ActionResult> {
  const user = await requireTaskUpdate(matterId, id);
  await db.task.update({ where: { id }, data: { status: "OPEN", doneAt: null, naReason: null } });
  await writeAudit({ userId: user.id, action: "task.reopen", entity: "Task", entityId: id });
  revalidatePath(`/cases/${matterId}`);
}

export async function markTaskNotApplicable(matterId: string, id: string, raw: unknown): Promise<ActionResult> {
  const parsed = naSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Say why." };
  const user = await requireTaskUpdate(matterId, id);
  await db.task.update({ where: { id }, data: { status: "NA", naReason: parsed.data.reason } });
  await writeAudit({ userId: user.id, action: "task.na", entity: "Task", entityId: id, after: { reason: parsed.data.reason } });
  revalidatePath(`/cases/${matterId}`);
}

export async function deleteTask(matterId: string, id: string): Promise<ActionResult> {
  const user = await requireTaskAssign(matterId);
  await db.task.delete({ where: { id } });
  await writeAudit({ userId: user.id, action: "task.delete", entity: "Task", entityId: id });
  revalidatePath(`/cases/${matterId}`);
}
