import type { Prisma } from "@/generated/prisma/client";
import { orgId } from "@/lib/org";
import { userIdsWithWorkingLink } from "@/lib/password-links";

export type UserFilters = {
  status?: string; // "active" | "invited" | "expired" | "deactivated" — see accountStatus()
  department?: string;
  certExpiring?: string; // "1" = within 60 days or already expired
};

export function parseUserFilters(sp: Record<string, string | string[] | undefined>): UserFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { status: one(sp.status), department: one(sp.department), certExpiring: one(sp.certExpiring) };
}

/** Shared between the list page and the export routes, so "export" always matches what's on screen.
 * Users & Access manages this one organisation's Admin/Lawyer accounts — never another
 * organisation's, and never Superadmin accounts (which belong to no organisation at all and
 * are managed from /superadmin instead). */
export async function buildUserWhere(filters: UserFilters, organizationId: string | null, now = new Date()): Promise<Prisma.UserWhereInput> {
  const where: Prisma.UserWhereInput = { deletedAt: null, role: { not: "SUPERADMIN" }, organizationId: orgId(organizationId) };
  const hasPassword: Prisma.UserWhereInput = { accounts: { some: { providerId: "credential" } } };
  const noPassword: Prisma.UserWhereInput = { accounts: { none: { providerId: "credential" } } };

  if (filters.status === "active") Object.assign(where, { isActive: true, ...hasPassword });
  else if (filters.status === "deactivated") where.isActive = false;
  else if (filters.status === "invited") Object.assign(where, { isActive: true, ...noPassword, id: { in: await userIdsWithWorkingLink(now) } });
  else if (filters.status === "expired") Object.assign(where, { isActive: true, ...noPassword, id: { notIn: await userIdsWithWorkingLink(now) } });

  if (filters.department) where.department = filters.department;

  if (filters.certExpiring === "1") {
    const cutoff = new Date(now.getTime() + 60 * 86_400_000);
    where.certExpiry = { lte: cutoff };
  }

  return where;
}
