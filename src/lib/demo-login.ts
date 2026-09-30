import "server-only";
import { hashPassword } from "better-auth/crypto";
import { db } from "./db";
import { env } from "./env";

/** Shared sign-in password for the pitch prototype, or null when the real invite flow is on. */
export function demoLoginPassword() {
  const value = env.DEMO_LOGIN_PASSWORD?.trim();
  return value || null;
}

/** Creates or replaces the Better Auth credential so this user can sign in with the shared password. */
export async function setDemoLoginPassword(userId: string) {
  const plain = demoLoginPassword();
  if (!plain) return false;
  const password = await hashPassword(plain);
  const existing = await db.account.findFirst({ where: { userId, providerId: "credential" } });
  if (existing) await db.account.update({ where: { id: existing.id }, data: { password } });
  else {
    await db.account.create({
      data: { userId, providerId: "credential", accountId: userId, password },
    });
  }
  await db.user.update({
    where: { id: userId },
    data: { emailVerified: true, mustChangePassword: false },
  });
  return true;
}
