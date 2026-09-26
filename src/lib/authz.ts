import "server-only";
import { redirect } from "next/navigation";
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
