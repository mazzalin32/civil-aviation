import "server-only";
import { cookies } from "next/headers";

export type Role = "ADMIN" | "LAWYER";

export type CurrentUser = {
  id: string;
  name: string;
  title: string;
  role: Role;
};

export const DEV_ROLE_COOKIE = "caa-dev-role";

/**
 * PHASE 0 STUB — replaced by real Better Auth sessions in Phase 1.
 * Returns a placeholder user whose role comes from a dev-only cookie so both
 * shells (Admin / Lawyer) can be viewed before login exists.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const jar = await cookies();
  const role: Role = jar.get(DEV_ROLE_COOKIE)?.value === "ADMIN" ? "ADMIN" : "LAWYER";
  return role === "ADMIN"
    ? { id: "dev-admin", name: "Head of Legal", title: "Director Legal Services", role }
    : { id: "dev-lawyer", name: "Legal Officer", title: "Legal Officer", role };
}
