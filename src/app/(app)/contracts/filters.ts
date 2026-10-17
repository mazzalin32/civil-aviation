import type { Prisma } from "@/generated/prisma/client";

export type ContractFilters = {
  q?: string;
  categoryId?: string;
  department?: string;
  stage?: string;
  agVettingStatusId?: string;
  internalApprovalStatusId?: string;
};

function str(v: string | string[] | undefined) {
  return typeof v === "string" && v ? v : undefined;
}

export function parseContractFilters(sp: Record<string, string | string[] | undefined>): ContractFilters {
  return {
    q: str(sp.q),
    categoryId: str(sp.categoryId),
    department: str(sp.department),
    stage: str(sp.stage),
    agVettingStatusId: str(sp.agVettingStatusId),
    internalApprovalStatusId: str(sp.internalApprovalStatusId),
  };
}

export function buildContractWhere(f: ContractFilters): Prisma.ContractWhereInput {
  const where: Prisma.ContractWhereInput = { deletedAt: null };

  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.stage) where.currentStage = { name: f.stage };
  if (f.department) where.originatingDepartment = f.department;
  if (f.agVettingStatusId) where.agVettingStatusId = f.agVettingStatusId;
  if (f.internalApprovalStatusId) where.internalApprovalStatusId = f.internalApprovalStatusId;

  if (f.q) {
    where.OR = [
      { title: { contains: f.q, mode: "insensitive" } },
      { reference: { contains: f.q, mode: "insensitive" } },
      { counterpartyName: { contains: f.q, mode: "insensitive" } },
    ];
  }

  return where;
}
