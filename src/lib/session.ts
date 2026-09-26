import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";

export type Role = "ADMIN" | "LAWYER";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
};

/** The Better Auth session for this request, or null if signed out / expired. */
export async function getAuthSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Our own user record for the signed-in session — role, title and the security flags
 * middleware and requireRole() gate on. A single extra query keeps those fields (which
 * Better Auth doesn't know about) as one source of truth in `User`, not duplicated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      twoFactorEnabled: true,
    },
  });
  if (!user || !user.isActive) return null;
  return user;
}
