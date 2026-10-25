"use server";

import { revalidatePath } from "next/cache";
import { AssignmentRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireMatterEdit, requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import {
  moveStageSchema,
  addEventSchema,
  updateSummarySchema,
  noteSchema,
  updateNoteSchema,
  partyFormSchema,
  reassignSchema,
  holdSchema,
  updateSourceUrlSchema,
} from "@/lib/validation/case-detail";

type ActionResult = { error?: string } | void;

async function eventTypeId(name: string) {
  const type = await db.eventType.findUnique({ where: { name } });
  if (!type) throw new Error(`Missing seeded EventType "${name}" — check Settings → Event types.`);
  return type.id;
}

function reload(matterId: string) {
  revalidatePath(`/cases/${matterId}`);
  revalidatePath("/cases");
}

export async function moveStage(raw: unknown): Promise<ActionResult> {
  const parsed = moveStageSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, stageTemplateId, note, fields } = parsed.data;
  const user = await requireMatterEdit(matterId);

  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId }, include: { currentStage: true } });
  const target = await db.stageTemplate.findUniqueOrThrow({ where: { id: stageTemplateId } });
  if (target.matterTypeId !== matter.matterTypeId) return { error: "That stage doesn't belong to this matter's lifecycle." };

  const goingBack = matter.currentStage && target.order < matter.currentStage.order;
  if (goingBack && !note) return { error: "Moving back a stage needs a short reason." };
  if (target.requiredFields.length > 0) {
    const missing = target.requiredFields.filter((k) => !fields?.[k]?.trim());
    if (missing.length > 0) return { error: `This stage needs: ${missing.join(", ")}.` };
  }

  const stageChangeType = await eventTypeId("Stage change");
  const fromName = matter.currentStage?.name ?? "—";

  await db.$transaction(async (tx) => {
    await tx.matterStage.updateMany({ where: { matterId, exitedAt: null }, data: { exitedAt: new Date() } });
    await tx.matterStage.create({
      data: { matterId, stageTemplateId, movedById: user.id, note: note || null, fields: fields ?? undefined },
    });
    await tx.matter.update({ where: { id: matterId }, data: { currentStageId: stageTemplateId, lastActivityAt: new Date() } });
    await tx.event.create({
      data: {
        matterId,
        typeId: stageChangeType,
        title: `Moved from ${fromName} to ${target.name}`,
        description: note || null,
        date: new Date(),
        createdById: user.id,
      },
    });
    await writeAudit({ userId: user.id, action: "matter.stage.move", entity: "Matter", entityId: matterId, before: { stage: fromName }, after: { stage: target.name } }, tx);
  });

  const team = await db.matterAssignment.findMany({ where: { matterId, removedAt: null }, select: { userId: true } });
  for (const { userId } of team) {
    await notify({
      userId,
      type: "STAGE_OR_CLOSURE_CHANGED",
      matterId,
      payload: { title: matter.title, from: fromName, to: target.name },
      subject: `Stage changed: ${matter.title}`,
      message: `"${matter.title}" moved from ${fromName} to ${target.name}.`,
      url: `/cases/${matterId}`,
    });
  }

  reload(matterId);
}

export async function addEvent(raw: unknown): Promise<ActionResult> {
  const parsed = addEventSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, typeId, title, description, date } = parsed.data;
  const user = await requireMatterEdit(matterId);

  await db.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: { matterId, typeId, title, description: description || null, date: new Date(date), createdById: user.id },
    });
    await tx.matter.update({ where: { id: matterId }, data: { lastActivityAt: new Date() } });
    await writeAudit({ userId: user.id, action: "matter.event.add", entity: "Event", entityId: event.id, after: { title } }, tx);
  });

  reload(matterId);
}

export async function updateSummary(raw: unknown): Promise<ActionResult> {
  const parsed = updateSummarySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, body } = parsed.data;
  const user = await requireMatterEdit(matterId);

  await db.$transaction(async (tx) => {
    const version = await tx.summaryVersion.create({ data: { matterId, body, authorId: user.id } });
    await tx.matter.update({ where: { id: matterId }, data: { lastActivityAt: new Date() } });
    await writeAudit({ userId: user.id, action: "matter.summary.update", entity: "SummaryVersion", entityId: version.id }, tx);
  });

  reload(matterId);
}

export async function updateSourceUrl(raw: unknown): Promise<ActionResult> {
  const parsed = updateSourceUrlSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, sourceUrl } = parsed.data;
  const user = await requireMatterEdit(matterId);

  await db.$transaction(async (tx) => {
    await tx.matter.update({ where: { id: matterId }, data: { sourceUrl: sourceUrl || null } });
    await writeAudit({ userId: user.id, action: "matter.sourceUrl.update", entity: "Matter", entityId: matterId, after: { sourceUrl: sourceUrl || null } }, tx);
  });

  reload(matterId);
}

export async function addNote(raw: unknown): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, body, isPrivate } = parsed.data;
  const user = await requireMatterEdit(matterId);

  const note = await db.note.create({ data: { matterId, body, isPrivate, authorId: user.id } });
  await writeAudit({ userId: user.id, action: "matter.note.add", entity: "Note", entityId: note.id });
  reload(matterId);
}

export async function updateNote(raw: unknown): Promise<ActionResult> {
  const parsed = updateNoteSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, id, body, isPrivate } = parsed.data;
  const user = await requireMatterEdit(matterId);

  const existing = await db.note.findUniqueOrThrow({ where: { id } });
  if (existing.matterId !== matterId) return { error: "That note no longer exists." };
  if (existing.authorId !== user.id && user.role !== "ADMIN") return { error: "Only the author or an Admin can edit this note." };

  await db.note.update({ where: { id }, data: { body, isPrivate } });
  await writeAudit({ userId: user.id, action: "matter.note.update", entity: "Note", entityId: id });
  reload(matterId);
}

export async function deleteNote(matterId: string, id: string): Promise<ActionResult> {
  const user = await requireMatterEdit(matterId);
  const existing = await db.note.findUniqueOrThrow({ where: { id } });
  if (existing.matterId !== matterId) return { error: "That note no longer exists." };
  if (existing.authorId !== user.id && user.role !== "ADMIN") return { error: "Only the author or an Admin can delete this note." };

  await db.note.delete({ where: { id } });
  await writeAudit({ userId: user.id, action: "matter.note.delete", entity: "Note", entityId: id });
  reload(matterId);
}

export async function addParty(raw: unknown): Promise<ActionResult> {
  const parsed = partyFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, name, kind, counselName, counselFirm, email, phone, address, department } = parsed.data;
  const user = await requireMatterEdit(matterId);

  const party = await db.party.create({
    data: { matterId, name, kind, counselName: counselName || null, counselFirm: counselFirm || null, email: email || null, phone: phone || null, address: address || null, department: department || null },
  });
  await writeAudit({ userId: user.id, action: "matter.party.add", entity: "Party", entityId: party.id, after: { name } });
  reload(matterId);
}

export async function updateParty(raw: unknown): Promise<ActionResult> {
  const parsed = partyFormSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, id, name, kind, counselName, counselFirm, email, phone, address, department } = parsed.data;
  if (!id) return { error: "Missing party id." };
  const user = await requireMatterEdit(matterId);

  const existingParty = await db.party.findUnique({ where: { id }, select: { matterId: true } });
  if (!existingParty || existingParty.matterId !== matterId) return { error: "That party no longer exists." };

  await db.party.update({
    where: { id },
    data: { name, kind, counselName: counselName || null, counselFirm: counselFirm || null, email: email || null, phone: phone || null, address: address || null, department: department || null },
  });
  await writeAudit({ userId: user.id, action: "matter.party.update", entity: "Party", entityId: id });
  reload(matterId);
}

export async function removeParty(matterId: string, id: string): Promise<ActionResult> {
  const user = await requireMatterEdit(matterId);
  const existingParty = await db.party.findUnique({ where: { id }, select: { matterId: true } });
  if (!existingParty || existingParty.matterId !== matterId) return { error: "That party no longer exists." };
  await db.party.delete({ where: { id } });
  await writeAudit({ userId: user.id, action: "matter.party.remove", entity: "Party", entityId: id });
  reload(matterId);
}

export async function reassign(raw: unknown): Promise<ActionResult> {
  const parsed = reassignSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, leadUserId, supportUserIds, reason } = parsed.data;
  const user = await requireMatterEdit(matterId);

  const allIds = [leadUserId, ...supportUserIds];
  const validCount = await db.user.count({ where: { id: { in: allIds }, organizationId: user.organizationId } });
  if (validCount !== new Set(allIds).size) return { error: "Choose lawyers from your organisation." };

  const current = await db.matterAssignment.findMany({ where: { matterId, removedAt: null } });
  const currentLead = current.find((a) => a.role === "LEAD");
  const desiredSupportIds = new Set(supportUserIds.filter((id) => id !== leadUserId));
  const assignmentType = await eventTypeId("Assignment change");

  await db.$transaction(async (tx) => {
    if (currentLead && currentLead.userId !== leadUserId) {
      await tx.matterAssignment.update({ where: { id: currentLead.id }, data: { removedAt: new Date() } });
    }
    if (!currentLead || currentLead.userId !== leadUserId) {
      const existingAsSupport = current.find((a) => a.role === "SUPPORT" && a.userId === leadUserId);
      if (existingAsSupport) await tx.matterAssignment.update({ where: { id: existingAsSupport.id }, data: { removedAt: new Date() } });
      await tx.matterAssignment.create({ data: { matterId, userId: leadUserId, role: AssignmentRole.LEAD, assignedById: user.id } });
    }

    for (const a of current) {
      if (a.role === "SUPPORT" && !desiredSupportIds.has(a.userId) && a.userId !== leadUserId) {
        await tx.matterAssignment.update({ where: { id: a.id }, data: { removedAt: new Date() } });
      }
    }
    const currentSupportIds = new Set(current.filter((a) => a.role === "SUPPORT").map((a) => a.userId));
    for (const uid of desiredSupportIds) {
      if (!currentSupportIds.has(uid)) {
        await tx.matterAssignment.create({ data: { matterId, userId: uid, role: AssignmentRole.SUPPORT, assignedById: user.id } });
      }
    }

    await tx.matter.update({ where: { id: matterId }, data: { lastActivityAt: new Date() } });
    await tx.event.create({
      data: { matterId, typeId: assignmentType, title: "Team reassigned", description: reason || null, date: new Date(), createdById: user.id },
    });
    await writeAudit({ userId: user.id, action: "matter.reassign", entity: "Matter", entityId: matterId, after: { leadUserId, supportUserIds: [...desiredSupportIds] } }, tx);
  });

  const matterForNotify = await db.matter.findUniqueOrThrow({ where: { id: matterId }, select: { title: true, reference: true } });
  const newlyAssigned = [leadUserId, ...desiredSupportIds].filter((id) => !current.some((a) => a.userId === id && a.removedAt === null));
  for (const userId of newlyAssigned) {
    const role = userId === leadUserId ? "Lead Counsel" : "Support";
    await notify({
      userId,
      type: "CASE_ASSIGNED",
      matterId,
      payload: { reference: matterForNotify.reference, title: matterForNotify.title, role },
      subject: `You've been assigned ${matterForNotify.title}`,
      message: `You've been assigned "${matterForNotify.title}" (${matterForNotify.reference}) as ${role}.`,
      url: `/cases/${matterId}`,
    });
  }

  reload(matterId);
}

export async function putOnHold(raw: unknown): Promise<ActionResult> {
  const parsed = holdSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, reason } = parsed.data;
  const user = await requireMatterEdit(matterId);

  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId } });
  if (matter.status !== "OPEN") return { error: "Only an open case can be put on hold." };

  await db.$transaction(async (tx) => {
    await tx.matter.update({ where: { id: matterId }, data: { status: "ON_HOLD", lastActivityAt: new Date() } });
    await writeAudit({ userId: user.id, action: "matter.hold", entity: "Matter", entityId: matterId, after: { reason: reason || null } }, tx);
  });

  reload(matterId);
}

export async function resumeCase(matterId: string): Promise<ActionResult> {
  const user = await requireMatterEdit(matterId);
  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId } });
  if (matter.status !== "ON_HOLD") return { error: "Only a case on hold can be resumed." };

  await db.$transaction(async (tx) => {
    await tx.matter.update({ where: { id: matterId }, data: { status: "OPEN", lastActivityAt: new Date() } });
    await writeAudit({ userId: user.id, action: "matter.resume", entity: "Matter", entityId: matterId }, tx);
  });

  reload(matterId);
}

/**
 * Admin-only "delete case". Never a hard delete (CLAUDE.md): the matter, its documents, messages
 * and audit trail are kept; it is just hidden from every list and its page returns 404.
 */
export async function deleteCase(matterId: string): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const matter = await db.matter.findUnique({ where: { id: matterId } });
  if (!matter || matter.deletedAt || matter.organizationId !== admin.organizationId) return { error: "That case no longer exists." };

  await db.$transaction(async (tx) => {
    await tx.matter.update({ where: { id: matterId }, data: { deletedAt: new Date(), deletedById: admin.id } });
    await writeAudit({ userId: admin.id, action: "matter.delete", entity: "Matter", entityId: matterId, before: { reference: matter.reference, title: matter.title } }, tx);
  });

  revalidatePath("/cases");
  revalidatePath("/dashboard");
}
