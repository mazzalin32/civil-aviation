import type { Prisma } from "@/generated/prisma/client";

export type UserFilters = {
  status?: string; // "active" | "invited" | "deactivated"
  department?: string;
  certExpiring?: string; // "1" = within 60 days or already expired
};

export function parseUserFilters(sp: Record<string, string | string[] | undefined>): UserFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { status: one(sp.status), department: one(sp.department), certExpiring: one(sp.certExpiring) };
}

/** Shared between the list page and the export routes, so "export" always matches what's on screen.
 * Users & Access manages this one organisation's Admin/Lawyer accounts — Superadmin accounts
 * belong to no organisation and are managed from /superadmin instead, so they're always excluded. */
export function buildUserWhere(filters: UserFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { deletedAt: null, role: { not: "SUPERADMIN" } };

  if (filters.status === "active") where.isActive = true;
  else if (filters.status === "deactivated") where.isActive = false;
  else if (filters.status === "invited") {
    where.isActive = true;
    where.accounts = { none: { providerId: "credential" } };
  }

  if (filters.department) where.department = filters.department;

  if (filters.certExpiring === "1") {
    const cutoff = new Date(Date.now() + 60 * 86_400_000);
    where.certExpiry = { lte: cutoff };
  }

  return where;
}
