"use server";

import { revalidatePath } from "next/cache";
import { AssignmentRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireContractEdit, requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { updateContractSchema, moveContractStageSchema, reassignContractSchema } from "@/lib/validation/contract";

type ActionResult = { error?: string } | void;

const dateOnly = (v?: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

function reload(contractId: string) {
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
}

export async function updateContract(raw: unknown): Promise<ActionResult> {
  const parsed = updateContractSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { contractId, ...fields } = parsed.data;
  const user = await requireContractEdit(contractId);

  const data = {
    originatingDepartment: fields.originatingDepartment || null,
    dateOfReceipt: dateOnly(fields.dateOfReceipt),
    dateSubmittedForReview: dateOnly(fields.dateSubmittedForReview),
    receiptStatusId: fields.receiptStatusId || null,
    legalReviewStatusId: fields.legalReviewStatusId || null,
    internalApprovalStatusId: fields.internalApprovalStatusId || null,
    agVettingStatusId: fields.agVettingStatusId || null,
    amendmentsStatusId: fields.amendmentsStatusId || null,
    caaExecutionStatus: fields.caaExecutionStatus,
    counterpartyExecutionStatus: fields.counterpartyExecutionStatus,
    dateOfSignature: dateOnly(fields.dateOfSignature),
    dateOfFullExecution: dateOnly(fields.dateOfFullExecution),
    commencementDate: dateOnly(fields.commencementDate),
    expiryDate: dateOnly(fields.expiryDate),
    outstandingAction: fields.outstandingAction || null,
    sourceUrl: fields.sourceUrl || null,
  };

  await db.$transaction(async (tx) => {
    await tx.contract.update({ where: { id: contractId }, data: { ...data, lastActivityAt: new Date() } });
    await writeAudit({ userId: user.id, action: "contract.update", entity: "Contract", entityId: contractId }, tx);
  });

  reload(contractId);
}

export async function moveContractStage(raw: unknown): Promise<ActionResult> {
  const parsed = moveContractStageSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { contractId, stageId } = parsed.data;
  const user = await requireContractEdit(contractId);

  const stage = await db.contractStage.findUniqueOrThrow({ where: { id: stageId } });

  await db.$transaction(async (tx) => {
    await tx.contract.update({ where: { id: contractId }, data: { currentStageId: stageId, lastActivityAt: new Date() } });
    await writeAudit({ userId: user.id, action: "contract.stage.move", entity: "Contract", entityId: contractId, after: { stage: stage.name } }, tx);
  });

  reload(contractId);
}

export async function reassignContract(raw: unknown): Promise<ActionResult> {
  const parsed = reassignContractSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { contractId, leadUserId, supportUserIds } = parsed.data;
  const user = await requireContractEdit(contractId);

  const allIds = [leadUserId, ...supportUserIds];
  const validCount = await db.user.count({ where: { id: { in: allIds }, organizationId: user.organizationId } });
  if (validCount !== new Set(allIds).size) return { error: "Choose lawyers from your organisation." };

  const current = await db.contractAssignment.findMany({ where: { contractId, removedAt: null } });
  const currentLead = current.find((a) => a.role === "LEAD");
  const desiredSupportIds = new Set(supportUserIds.filter((id) => id !== leadUserId));

  await db.$transaction(async (tx) => {
    if (currentLead && currentLead.userId !== leadUserId) {
      await tx.contractAssignment.update({ where: { id: currentLead.id }, data: { removedAt: new Date() } });
    }
    if (!currentLead || currentLead.userId !== leadUserId) {
      const existingAsSupport = current.find((a) => a.role === "SUPPORT" && a.userId === leadUserId);
      if (existingAsSupport) await tx.contractAssignment.update({ where: { id: existingAsSupport.id }, data: { removedAt: new Date() } });
      await tx.contractAssignment.create({ data: { contractId, userId: leadUserId, role: AssignmentRole.LEAD, assignedById: user.id } });
    }

    for (const a of current) {
      if (a.role === "SUPPORT" && !desiredSupportIds.has(a.userId) && a.userId !== leadUserId) {
        await tx.contractAssignment.update({ where: { id: a.id }, data: { removedAt: new Date() } });
      }
    }
    const currentSupportIds = new Set(current.filter((a) => a.role === "SUPPORT").map((a) => a.userId));
    for (const uid of desiredSupportIds) {
      if (!currentSupportIds.has(uid)) {
        await tx.contractAssignment.create({ data: { contractId, userId: uid, role: AssignmentRole.SUPPORT, assignedById: user.id } });
      }
    }

    await tx.contract.update({ where: { id: contractId }, data: { lastActivityAt: new Date() } });
    await writeAudit({ userId: user.id, action: "contract.reassign", entity: "Contract", entityId: contractId, after: { leadUserId, supportUserIds: [...desiredSupportIds] } }, tx);
  });

  const contractForNotify = await db.contract.findUniqueOrThrow({ where: { id: contractId }, select: { title: true, reference: true } });
  const newlyAssigned = [leadUserId, ...desiredSupportIds].filter((id) => !current.some((a) => a.userId === id && a.removedAt === null));
  for (const userId of newlyAssigned) {
    const role = userId === leadUserId ? "Lead Counsel" : "Support";
    await notify({
      userId,
      type: "CASE_ASSIGNED",
      contractId,
      payload: { reference: contractForNotify.reference, title: contractForNotify.title, role },
      subject: `You've been assigned ${contractForNotify.title}`,
      message: `You've been assigned "${contractForNotify.title}" (${contractForNotify.reference}) as ${role}.`,
      url: `/contracts/${contractId}`,
    });
  }

  reload(contractId);
}

export async function deleteContract(contractId: string): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const contract = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  if (contract.organizationId !== admin.organizationId) return { error: "That contract no longer exists." };

  await db.$transaction(async (tx) => {
    await tx.contract.update({ where: { id: contractId }, data: { deletedAt: new Date(), deletedById: admin.id } });
    await writeAudit({ userId: admin.id, action: "contract.delete", entity: "Contract", entityId: contractId, before: { reference: contract.reference, title: contract.title } }, tx);
  });

  revalidatePath("/contracts");
}
