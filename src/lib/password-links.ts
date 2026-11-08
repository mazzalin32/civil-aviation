import "server-only";
import { db } from "./db";
import type { InviteLink } from "./invite-status";

/**
 * Better Auth's single-use password links (invite and "forgot password" alike) live in
 * Verification as identifier "reset-password:<token>", value = the user's id. Kept separate
 * from invites.ts so auth.ts can use it without an import cycle.
 */
export const PASSWORD_LINK_PREFIX = "reset-password:";

/** Removes every password link for these people except `keepToken` (all of them when omitted). */
export async function cancelPasswordLinks(userId: string | string[], keepToken?: string) {
  const ids = Array.isArray(userId) ? userId : [userId];
  if (ids.length === 0) return;
  await db.verification.deleteMany({
    where: {
      value: { in: ids },
      identifier: keepToken ? { startsWith: PASSWORD_LINK_PREFIX, not: `${PASSWORD_LINK_PREFIX}${keepToken}` } : { startsWith: PASSWORD_LINK_PREFIX },
    },
  });
}

/** Newest password link per person (working or not) — feeds accountStatus(). */
export async function latestPasswordLinks(userIds: string[]): Promise<Map<string, InviteLink>> {
  const map = new Map<string, InviteLink>();
  if (userIds.length === 0) return map;
  const rows = await db.verification.findMany({
    where: { value: { in: userIds }, identifier: { startsWith: PASSWORD_LINK_PREFIX } },
    orderBy: { createdAt: "asc" },
    select: { value: true, createdAt: true, expiresAt: true },
  });
  for (const r of rows) map.set(r.value, { sentAt: r.createdAt, expiresAt: r.expiresAt });
  return map;
}

/** When each person's invite last went out (audit log) — the fallback once the link record is gone. */
export async function lastInviteSentAt(userIds: string[]): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (userIds.length === 0) return map;
  const rows = await db.auditLog.groupBy({
    by: ["entityId"],
    where: { entity: "User", entityId: { in: userIds }, action: { in: ["user.invite.sent", "user.invite.resent"] } },
    _max: { createdAt: true },
  });
  for (const r of rows) if (r.entityId && r._max.createdAt) map.set(r.entityId, r._max.createdAt);
  return map;
}

/** Link + last-sent time for everyone who hasn't set a password yet — what accountStatus() needs. */
export async function inviteInfo(userIds: string[]) {
  const [links, sent] = await Promise.all([latestPasswordLinks(userIds), lastInviteSentAt(userIds)]);
  return (id: string) => ({ link: links.get(id) ?? null, lastSentAt: sent.get(id) ?? null });
}

/** Everyone who currently holds a working password link — for the "Invited" / "Invite expired" filters. */
export async function userIdsWithWorkingLink(now = new Date()) {
  const rows = await db.verification.findMany({
    where: { identifier: { startsWith: PASSWORD_LINK_PREFIX }, expiresAt: { gt: now } },
    select: { value: true },
    distinct: ["value"],
  });
  return rows.map((r) => r.value);
}
