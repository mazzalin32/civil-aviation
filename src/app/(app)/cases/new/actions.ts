"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { AssignmentRole, PartyKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { generateReference } from "@/lib/reference";
import { createMatterSchema, type WizardData } from "@/lib/validation/matter";

export async function loadDraft(): Promise<WizardData | null> {
  const admin = await requireRole("ADMIN");
  const draft = await db.wizardDraft.findUnique({ where: { userId: admin.id } });
  return (draft?.data as WizardData) ?? null;
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

type CreateResult = { error: string } | { matterId: string; reference: string };

export async function createMatter(raw: unknown): Promise<CreateResult> {
  const admin = await requireRole("ADMIN");
  const parsed = createMatterSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  const { basics, forum, parties, facts, assign } = parsed.data;

  const matterType = await db.matterType.findUnique({ where: { id: basics.matterTypeId } });
  if (!matterType?.referencePrefix) return { error: "That matter type has no reference prefix configured (Settings → Matter types)." };

  const stage = await db.stageTemplate.findUnique({ where: { id: assign.stageTemplateId } });
  if (!stage || stage.matterTypeId !== basics.matterTypeId) return { error: "Choose a starting stage that belongs to the selected matter type." };

  const lead = await db.user.findUnique({ where: { id: assign.leadUserId }, select: { isActive: true, role: true } });
  if (!lead?.isActive || lead.role !== "LAWYER") return { error: "Choose an active lawyer as lead." };

  const matter = await db.$transaction(async (tx) => {
    const reference = await generateReference(matterType.referencePrefix!, tx);

    const created = await tx.matter.create({
      data: {
        reference,
        title: basics.title,
        categoryId: basics.categoryId,
        matterTypeId: basics.matterTypeId,
        ucaaRole: basics.ucaaRole,
        priority: basics.priority,
        confidentiality: basics.confidentiality,
        currentStageId: stage.id,
        forumId: forum.skip || !forum.forumId ? null : forum.forumId,
        courtCaseNo: forum.courtCaseNo || null,
        eccmisNo: forum.eccmisNo || null,
        eccmisUrl: forum.eccmisUrl || null,
        judge: forum.judge || null,
        amountClaimed: facts.amountClaimed ? BigInt(facts.amountClaimed) : null,
        amountAgainst: facts.amountAgainst ? BigInt(facts.amountAgainst) : null,
        causeOfActionDate: facts.causeOfActionDate ? new Date(facts.causeOfActionDate) : null,
        referralNote: facts.referralNote || null,
        createdById: admin.id,
      },
    });

    await tx.matterStage.create({
      data: { matterId: created.id, stageTemplateId: stage.id, movedById: admin.id, note: "Case opened" },
    });

    await tx.matterAssignment.create({ data: { matterId: created.id, userId: assign.leadUserId, role: AssignmentRole.LEAD, assignedById: admin.id } });
    for (const userId of assign.supportUserIds.filter((id) => id !== assign.leadUserId)) {
      await tx.matterAssignment.create({ data: { matterId: created.id, userId, role: AssignmentRole.SUPPORT, assignedById: admin.id } });
    }

    const partyRows: Prisma.PartyCreateManyInput[] = [];
    for (const p of parties.opposing) {
      if (!p.name) continue;
      partyRows.push({ matterId: created.id, name: p.name, kind: PartyKind.OPPOSING, counselName: p.counselName || null, counselFirm: p.counselFirm || null, email: p.email || null, phone: p.phone || null });
    }
    for (const w of parties.witnesses) {
      if (!w.name) continue;
      partyRows.push({ matterId: created.id, name: w.name, kind: PartyKind.WITNESS, phone: w.phone || null });
    }
    if (parties.internalContactName) {
      partyRows.push({ matterId: created.id, name: parties.internalContactName, kind: PartyKind.INTERNAL, department: parties.internalContactDepartment || null });
    }
    if (partyRows.length > 0) await tx.party.createMany({ data: partyRows });

    await writeAudit(
      { userId: admin.id, action: "matter.create", entity: "Matter", entityId: created.id, after: { reference: created.reference, title: created.title } },
      tx,
    );
    await tx.wizardDraft.deleteMany({ where: { userId: admin.id } });

    return created;
  });

  revalidatePath("/cases");
  return { matterId: matter.id, reference: matter.reference };
}
