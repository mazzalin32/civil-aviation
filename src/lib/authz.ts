import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type Role } from "./session";

/**
 * The single role gate for pages and mutations (CLAUDE.md conventions).
 * Phase 1 adds the unauthenticated → /login branch; Phase 4 adds canAccessMatter().
 */
export async function requireRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (roles.length > 0 && !roles.includes(user.role)) redirect("/forbidden");
  return user;
}
