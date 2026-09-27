import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getCurrentUser, type Role } from "./session";

/**
 * The single role gate for pages and mutations (CLAUDE.md conventions). Proxy already
 * keeps a signed-out or not-yet-onboarded user out of every gated route, so reaching
 * here with the wrong role means "wrong page for this role", not "not logged in".
 */
export async function requireRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) redirect("/forbidden");
  return user;
}

/** Admin sees every matter; a lawyer only ones they lead or support (MatterAccess grants come later). */
export async function canAccessMatter(userId: string, role: Role, matterId: string) {
  if (role === "ADMIN") return true;
  const assignment = await db.matterAssignment.findFirst({ where: { matterId, userId, removedAt: null } });
  return assignment !== null;
}

/** The matter-page equivalent of requireRole() — every case-detail page/action gates through this. */
export async function requireMatterAccess(matterId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = await canAccessMatter(user.id, user.role, matterId);
  if (!allowed) redirect("/forbidden");
  return user;
}
