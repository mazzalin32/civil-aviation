"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { AssignmentRole, CalendarKind, PartyKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { generateReference } from "@/lib/reference";
import { notify } from "@/lib/notify";
import { createMatterSchema, type WizardData } from "@/lib/validation/matter";

export async function loadDraft(): Promise<WizardData | null> {
  const admin = await requireRole("ADMIN");
  const draft = await db.wizardDraft.findUnique({ where: { userId: admin.id } });
  const data = draft?.data as WizardData | undefined;
  // Drafts saved by the old 5-step wizard have a different shape — start fresh instead of loading them.
  return data?.v === 2 ? data : null;
}

/** Called on every step change — cheap upsert, no validation (the draft can be partial). */
export async function saveDraft(data: WizardData) {
  const admin = await requireRole("ADMIN");
  await db.wizardDraft.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, data: data as Prisma.InputJsonValue },
    update: { data: data as Prisma.InputJsonValue },
  });
}

export async function discardDraft() {
  const admin = await requireRole("ADMIN");
  await db.wizardDraft.deleteMany({ where: { userId: admin.id } });
}

/** Spec §5.5 step 2: "warns if a case with the same court number or same parties exists." */
export async function checkDuplicates(courtCaseNo: string, partyNames: string[]) {
  await requireRole("ADMIN");
  const names = partyNames.map((n) => n.trim()).filter(Boolean);
  const trimmedCourtNo = courtCaseNo.trim();
  if (!trimmedCourtNo && names.length === 0) return [];

  const matches = await db.matter.findMany({
    where: {
      OR: [
        ...(trimmedCourtNo ? [{ courtCaseNo: trimmedCourtNo }] : []),
        ...(names.length ? [{ parties: { some: { name: { in: names, mode: "insensitive" as const } } } }] : []),
      ],
    },
    select: { id: true, reference: true, title: true },
    take: 5,
  });
  return matches;
}

export async function getAssignableLawyers() {
  await requireRole("ADMIN");
  const lawyers = await db.user.findMany({
    where: { role: "LAWYER", isActive: true },
    select: {
      id: true,
      name: true,
      title: true,
      _count: { select: { matterAssignments: { where: { removedAt: null, matter: { status: { in: ["OPEN", "ON_HOLD"] } } } } } },
    },
    orderBy: { name: "asc" },
  });
  return lawyers.map((l) => ({ id: l.id, name: l.name, title: l.title, workload: l._count.matterAssignments }));
}

type CreateResult = { error: string } | { matterId: string; reference: string; defaultFolderId: string | null };

const dateOnly = (v?: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);
/** Deadlines are stored in UTC; "due on a date" means end of that day in Africa/Kampala (UTC+3). */
const endOfDayKampala = (v: string) => new Date(`${v}T23:59:00+03:00`);

export async function createMatter(raw: unknown): Promise<CreateResult> {
  const admin = await requireRole("ADMIN");
  const parsed = createMatterSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  const { identification, position, service, parties, court, representation, stage: stageInput } = parsed.data;

  const matterType = await db.matterType.findUnique({ where: { id: identification.matterTypeId } });
  if (!matterType?.referencePrefix) return { error: "That matter type has no reference prefix configured (Settings → Matter types)." };

  const stage = await db.stageTemplate.findUnique({ where: { id: stageInput.stageTemplateId } });
  if (!stage || stage.matterTypeId !== identification.matterTypeId) return { error: "Choose a current stage that belongs to the selected matter type." };

  const lead = await db.user.findUnique({ where: { id: representation.leadUserId }, select: { isActive: true, role: true } });
  if (!lead?.isActive || lead.role !== "LAWYER") return { error: "Choose an active lawyer as the responsible legal officer." };

  const reportedAt = new Date(`${identification.reportedDate}T${identification.reportedTime || "00:00"}:00+03:00`);

  if (!admin.organizationId) return { error: "Your account isn't linked to an organisation." };

  const matter = await db.$transaction(async (tx) => {
    const reference = await generateReference(matterType.referencePrefix!, tx);

    const created = await tx.matter.create({
      data: {
        reference,
        organizationId: admin.organizationId!,
        title: identification.title,
        categoryId: identification.categoryId,
        matterTypeId: identification.matterTypeId,
        ucaaRole: position.ucaaRole,
        priority: stageInput.priority,
        confidentiality: stageInput.confidentiality,
        currentStageId: stage.id,
        description: identification.description || null,
        reportedAt,
        reportedBy: identification.reportedBy || null,
        reportMethod: identification.reportMethod || null,
        serviceDirection: service.direction,
        processNature: service.processNature || null,
        processIssuedAt: dateOnly(service.issuedAt),
        processReceivedAt: dateOnly(service.receivedAt),
        receivedBy: service.receivedBy || null,
        legalRecipientId: service.recipientId || null,
        forumId: court.skip || !court.forumId ? null : court.forumId,
        courtStation: court.courtStation || null,
        courtCaseNo: court.courtCaseNo || null,
        filedAt: dateOnly(court.filedAt),
        jurisdiction: court.jurisdiction || null,
        judge: court.judge || null,
        eccmisNo: court.eccmisNo || null,
        eccmisUrl: court.eccmisUrl || null,
        representationStatus: representation.representationStatus || null,
        externalCounselName: representation.externalCounselName || null,
        externalCounselContact: representation.externalCounselContact || null,
        createdById: admin.id,
      },
    });

    await tx.matterStage.create({
      data: { matterId: created.id, stageTemplateId: stage.id, movedById: admin.id, note: "Case opened" },
    });

    await tx.matterAssignment.create({ data: { matterId: created.id, userId: representation.leadUserId, role: AssignmentRole.LEAD, assignedById: admin.id } });
    for (const userId of representation.supportUserIds.filter((id) => id !== representation.leadUserId)) {
      await tx.matterAssignment.create({ data: { matterId: created.id, userId, role: AssignmentRole.SUPPORT, assignedById: admin.id } });
    }

    const partyRows: Prisma.PartyCreateManyInput[] = [];
    if (position.partyName) {
      const contact = position.partyContact ?? "";
      partyRows.push({
        matterId: created.id,
        name: position.partyName,
        kind: PartyKind.OPPOSING,
        partyType: position.partyType || null,
        email: contact.includes("@") ? contact : null,
        phone: contact && !contact.includes("@") ? contact : null,
        address: position.partyAddress || null,
        roleInMatter: "Main other party",
      });
    }
    for (const p of parties.rows) {
      if (!p.name) continue;
      partyRows.push({
        matterId: created.id,
        name: p.name,
        kind: /witness/i.test(p.role ?? "") ? PartyKind.WITNESS : PartyKind.OTHER,
        organisation: p.organisation || null,
        partyType: p.partyType || null,
        roleInMatter: p.role || null,
      });
    }
    if (partyRows.length > 0) await tx.party.createMany({ data: partyRows });

    // Deadlines are data: the response deadline and the next action both become real calendar entries.
    if (service.responseDeadline) {
      await tx.calendarEntry.create({
        data: {
          matterId: created.id,
          kind: CalendarKind.DEADLINE,
          title: `Response deadline${service.processNature ? ` — ${service.processNature}` : ""}`,
          startsAt: endOfDayKampala(service.responseDeadline),
          isCritical: true,
          assigneeId: representation.leadUserId,
        },
      });
    }
    if (stageInput.nextActionDue) {
      await tx.calendarEntry.create({
        data: {
          matterId: created.id,
          kind: CalendarKind.DEADLINE,
          title: "Next action due",
          purpose: stageInput.internalNotes || null,
          startsAt: endOfDayKampala(stageInput.nextActionDue),
          assigneeId: representation.leadUserId,
        },
      });
    }
    if (stageInput.internalNotes) {
      await tx.note.create({ data: { matterId: created.id, authorId: admin.id, body: stageInput.internalNotes, isPrivate: false } });
    }

    await writeAudit(
      { userId: admin.id, action: "matter.create", entity: "Matter", entityId: created.id, after: { reference: created.reference, title: created.title } },
      tx,
    );
    await tx.wizardDraft.deleteMany({ where: { userId: admin.id } });

    return created;
  });

  revalidatePath("/cases");

  const assignedIds = [representation.leadUserId, ...representation.supportUserIds.filter((id) => id !== representation.leadUserId)];
  for (const userId of assignedIds) {
    const role = userId === representation.leadUserId ? "Lead Counsel" : "Support";
    await notify({
      userId,
      type: "CASE_ASSIGNED",
      matterId: matter.id,
      payload: { reference: matter.reference, title: identification.title, role },
      subject: `You've been assigned ${identification.title}`,
      message: `You've been assigned "${identification.title}" (${matter.reference}) as ${role}.`,
      url: `/cases/${matter.id}`,
    });
  }

  const defaultFolder = await db.documentFolder.findFirst({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true } });
  return { matterId: matter.id, reference: matter.reference, defaultFolderId: defaultFolder?.id ?? null };
}
