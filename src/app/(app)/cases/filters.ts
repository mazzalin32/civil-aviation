import type { Prisma } from "@/generated/prisma/client";
import { resolveDateRange, type TimePreset } from "@/lib/date-range";

export type DateField = "createdAt" | "closedAt" | "lastActivityAt";
export type SortKey = "lastActivityAt" | "createdAt" | "priority" | "value" | "title";

export type CaseFilters = {
  q?: string;
  status?: string;
  stage?: string;
  categoryId?: string;
  matterTypeId?: string;
  forumId?: string;
  lawyerId?: string;
  priority?: string;
  ucaaRole?: string;
  valueMin?: string;
  valueMax?: string;
  highRisk?: boolean;
  dateField: DateField;
  preset?: TimePreset;
  from?: string;
  to?: string;
  sort: SortKey;
  dir: "asc" | "desc";
};

function str(v: string | string[] | undefined) {
  return typeof v === "string" && v ? v : undefined;
}

export function parseCaseFilters(sp: Record<string, string | string[] | undefined>): CaseFilters {
  return {
    q: str(sp.q),
    status: str(sp.status),
    stage: str(sp.stage),
    categoryId: str(sp.categoryId),
    matterTypeId: str(sp.matterTypeId),
    forumId: str(sp.forumId),
    lawyerId: str(sp.lawyerId),
    priority: str(sp.priority),
    ucaaRole: str(sp.ucaaRole),
    valueMin: str(sp.valueMin),
    valueMax: str(sp.valueMax),
    highRisk: str(sp.highRisk) === "1",
    dateField: (str(sp.dateField) as DateField) ?? "lastActivityAt",
    preset: str(sp.preset) as TimePreset | undefined,
    from: str(sp.from),
    to: str(sp.to),
    sort: (str(sp.sort) as SortKey) ?? "lastActivityAt",
    dir: str(sp.dir) === "asc" ? "asc" : "desc",
  };
}

export function buildCaseWhere(f: CaseFilters): Prisma.MatterWhereInput {
  const where: Prisma.MatterWhereInput = {};

  if (f.status) where.status = f.status as Prisma.EnumMatterStatusFilter["equals"];
  if (f.stage) where.currentStage = { name: f.stage };
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.matterTypeId) where.matterTypeId = f.matterTypeId;
  if (f.forumId) where.forumId = f.forumId;
  if (f.highRisk) where.priority = { in: ["HIGH", "URGENT"] };
  else if (f.priority) where.priority = f.priority as Prisma.EnumPriorityFilter["equals"];
  if (f.ucaaRole) where.ucaaRole = f.ucaaRole as Prisma.EnumUcaaRoleFilter["equals"];
  if (f.lawyerId) where.assignments = { some: { userId: f.lawyerId, removedAt: null } };

  if (f.valueMin || f.valueMax) {
    where.amountClaimed = {
      ...(f.valueMin ? { gte: BigInt(f.valueMin) } : {}),
      ...(f.valueMax ? { lte: BigInt(f.valueMax) } : {}),
    };
  }

  if (f.q) {
    where.OR = [
      { title: { contains: f.q, mode: "insensitive" } },
      { reference: { contains: f.q, mode: "insensitive" } },
      { courtCaseNo: { contains: f.q, mode: "insensitive" } },
      { eccmisNo: { contains: f.q, mode: "insensitive" } },
      { parties: { some: { name: { contains: f.q, mode: "insensitive" } } } },
    ];
  }

  if (f.preset) {
    const range = resolveDateRange(f.preset, f.from, f.to);
    if (range) where[f.dateField] = { gte: range.gte, lt: range.lt };
  }

  return where;
}

// Severity order, not alphabetical — the enum's own string order (HIGH, LOW, MEDIUM, URGENT)
// doesn't match, so "priority" sort is applied in JS after fetching (see PRIORITY_RANK).
export const PRIORITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };

export function buildCaseOrderBy(f: CaseFilters): Prisma.MatterOrderByWithRelationInput {
  if (f.sort === "value") return { amountClaimed: f.dir };
  if (f.sort === "title") return { title: f.dir };
  if (f.sort === "createdAt") return { createdAt: f.dir };
  if (f.sort === "priority") return { lastActivityAt: "desc" }; // re-sorted in JS by the caller
  return { lastActivityAt: f.dir };
}
