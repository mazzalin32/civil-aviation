"use server";

import { revalidatePath } from "next/cache";
import { PartyKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { generateReference } from "@/lib/reference";
import { notify } from "@/lib/notify";
import { createContractSchema } from "@/lib/validation/contract";

type CreateResult = { error: string } | { matterId: string; reference: string };

const dateOnly = (v?: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

export async function getContractIntakeOptions() {
  await requireRole("ADMIN");
  const [categories, lawyers] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { role: "LAWYER", isActive: true },
      select: { id: true, name: true, _count: { select: { matterAssignments: { where: { removedAt: null, matter: { status: { in: ["OPEN", "ON_HOLD"] } } } } } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return { categories, lawyers: lawyers.map((l) => ({ id: l.id, name: l.name, workload: l._count.matterAssignments })) };
}

export async function createContract(raw: unknown): Promise<CreateResult> {
  const admin = await requireRole("ADMIN");
  const parsed = createContractSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  const data = parsed.data;

  const matterType = await db.matterType.findUnique({ where: { name: "Contract" }, include: { stages: { where: { isActive: true }, orderBy: { order: "asc" } } } });
  if (!matterType?.referencePrefix) return { error: "The Contract matter type isn't configured (Settings → Matter types)." };
  const initialStage = matterType.stages[0];
  if (!initialStage) return { error: "The Contract matter type has no lifecycle stages configured." };

  const lead = await db.user.findUnique({ where: { id: data.leadUserId }, select: { isActive: true, role: true } });
  if (!lead?.isActive || lead.role !== "LAWYER") return { error: "Choose an active lawyer as the responsible legal officer." };

  const matter = await db.$transaction(async (tx) => {
    const reference = await generateReference(matterType.referencePrefix!, tx);

    const created = await tx.matter.create({
      data: {
        reference,
        title: data.title,
        categoryId: data.categoryId,
        matterTypeId: matterType.id,
        ucaaRole: "OTHER",
        currentStageId: initialStage.id,
        reportedAt: new Date(),
        representationStatus: "In-house counsel",
        createdById: admin.id,
      },
    });

    await tx.matterStage.create({ data: { matterId: created.id, stageTemplateId: initialStage.id, movedById: admin.id, note: "Contract opened" } });
    await tx.matterAssignment.create({ data: { matterId: created.id, userId: data.leadUserId, role: "LEAD", assignedById: admin.id } });
    await tx.party.create({ data: { matterId: created.id, name: data.counterpartyName, kind: PartyKind.OTHER, roleInMatter: "Counterparty" } });
    await tx.contractDetail.create({
      data: {
        matterId: created.id,
        originatingDepartment: data.originatingDepartment || null,
        dateOfReceipt: dateOnly(data.dateOfReceipt),
        commencementDate: dateOnly(data.commencementDate),
        expiryDate: dateOnly(data.expiryDate),
      },
    });

    await writeAudit({ userId: admin.id, action: "matter.create", entity: "Matter", entityId: created.id, after: { reference: created.reference, title: created.title } }, tx);

    return created;
  });

  revalidatePath("/contracts");
  revalidatePath("/cases");

  await notify({
    userId: data.leadUserId,
    type: "CASE_ASSIGNED",
    matterId: matter.id,
    payload: { reference: matter.reference, title: data.title, role: "Lead Counsel" },
    subject: `You've been assigned ${data.title}`,
    message: `You've been assigned "${data.title}" (${matter.reference}) as Lead Counsel.`,
    url: `/cases/${matter.id}`,
  });

  return { matterId: matter.id, reference: matter.reference };
}
