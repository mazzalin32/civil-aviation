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

/** Everyone in the org reads every matter (prototype: "the whole org sees the same data") —
 *  kept as a function, not a constant, since a later phase may reintroduce confidentiality
 *  tiers that narrow this again. */
export async function canAccessMatter(_userId: string, _role: Role, _matterId: string) {
  return true;
}

async function matterAssignmentRole(userId: string, matterId: string) {
  const assignment = await db.matterAssignment.findFirst({ where: { matterId, userId, removedAt: null } });
  return assignment?.role ?? null;
}

/** Admin, or the matter's Lead/Support lawyer — gates edits to case data (stage, parties,
 *  summary, notes, closure). Everyone else gets read-only + can still upload documents
 *  and post in the case discussion (see canUploadDocument). */
export async function canEditMatter(userId: string, role: Role, matterId: string) {
  if (role === "ADMIN") return true;
  const assignmentRole = await matterAssignmentRole(userId, matterId);
  return assignmentRole === "LEAD" || assignmentRole === "SUPPORT";
}

/** Only the matter's Lead (or Admin) can assign tasks to other people on it. */
export async function canAssignTasks(userId: string, role: Role, matterId: string) {
  if (role === "ADMIN") return true;
  return (await matterAssignmentRole(userId, matterId)) === "LEAD";
}

/** Any logged-in user may upload a supporting document to any matter, regardless of assignment. */
export function canUploadDocument(_userId: string, _role: Role, _matterId: string) {
  return true;
}

/** The matter-page equivalent of requireRole() — view access is org-wide, so this now only
 *  checks that someone is signed in (kept as its own helper so callers read clearly). */
export async function requireMatterAccess(_matterId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Gate for mutations that change case data itself — Admin or the matter's Lead/Support. */
export async function requireMatterEdit(matterId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = await canEditMatter(user.id, user.role, matterId);
  if (!allowed) redirect("/forbidden");
  return user;
}

/** Gate for assigning/reassigning tasks — Admin or the matter's Lead only. */
export async function requireTaskAssign(matterId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = await canAssignTasks(user.id, user.role, matterId);
  if (!allowed) redirect("/forbidden");
  return user;
}
