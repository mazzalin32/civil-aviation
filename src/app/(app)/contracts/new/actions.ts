"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { orgId } from "@/lib/org";
import { writeAudit } from "@/lib/audit";
import { generateReference } from "@/lib/reference";
import { notify } from "@/lib/notify";
import { createContractSchema } from "@/lib/validation/contract";

type CreateResult = { error: string } | { contractId: string; reference: string };

const dateOnly = (v?: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);
const CONTRACT_REFERENCE_PREFIX = "CTR";

export async function getContractIntakeOptions() {
  const admin = await requireRole("ADMIN");
  const [categories, lawyers] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { role: "LAWYER", isActive: true, organizationId: orgId(admin.organizationId) },
      select: { id: true, name: true, _count: { select: { contractAssignments: { where: { removedAt: null, contract: { deletedAt: null } } } } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return { categories, lawyers: lawyers.map((l) => ({ id: l.id, name: l.name, workload: l._count.contractAssignments })) };
}

export async function createContract(raw: unknown): Promise<CreateResult> {
  const admin = await requireRole("ADMIN");
  const parsed = createContractSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  const data = parsed.data;

  const initialStage = await db.contractStage.findFirst({ where: { isActive: true }, orderBy: { order: "asc" } });
  if (!initialStage) return { error: "No contract lifecycle stages are configured (Settings → Contract stages)." };

  if (!admin.organizationId) return { error: "Your account isn't linked to an organisation." };
  const lead = await db.user.findUnique({ where: { id: data.leadUserId }, select: { isActive: true, role: true, organizationId: true } });
  if (!lead?.isActive || lead.role !== "LAWYER" || lead.organizationId !== admin.organizationId) return { error: "Choose an active lawyer as the responsible legal officer." };

  const contract = await db.$transaction(async (tx) => {
    const reference = await generateReference(CONTRACT_REFERENCE_PREFIX, tx);

    const created = await tx.contract.create({
      data: {
        reference,
        organizationId: admin.organizationId!,
        title: data.title,
        categoryId: data.categoryId,
        counterpartyName: data.counterpartyName,
        originatingDepartment: data.originatingDepartment || null,
        dateOfReceipt: dateOnly(data.dateOfReceipt),
        commencementDate: dateOnly(data.commencementDate),
        expiryDate: dateOnly(data.expiryDate),
        currentStageId: initialStage.id,
        createdById: admin.id,
      },
    });

    await tx.contractAssignment.create({ data: { contractId: created.id, userId: data.leadUserId, role: "LEAD", assignedById: admin.id } });

    await writeAudit({ userId: admin.id, action: "contract.create", entity: "Contract", entityId: created.id, after: { reference: created.reference, title: created.title } }, tx);

    return created;
  });

  revalidatePath("/contracts");

  await notify({
    userId: data.leadUserId,
    type: "CASE_ASSIGNED",
    contractId: contract.id,
    payload: { reference: contract.reference, title: data.title, role: "Lead Counsel" },
    subject: `You've been assigned ${data.title}`,
    message: `You've been assigned "${data.title}" (${contract.reference}) as Lead Counsel.`,
    url: `/contracts/${contract.id}`,
  });

  return { contractId: contract.id, reference: contract.reference };
}
