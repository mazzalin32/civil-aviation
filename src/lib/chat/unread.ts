import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { getDepartmentUnread } from "./department";

/**
 * Unread tracking for case chats. `MatterChatRead.lastReadAt` is how far a person has read a thread.
 * With no row yet, "read" means "up to when you could first see this chat": your assignment date, or
 * for an Admin the date their account was created — so joining a case doesn't flood you with history.
 */

type Who = { id: string; role: string; organizationId: string | null };

/** Unread message count per matter (matters with none are omitted). Pass `matterIds` to restrict. */
export async function getUnreadCounts(user: Who, matterIds?: string[]): Promise<Map<string, number>> {
  if (matterIds && matterIds.length === 0) return new Map();
  const isAdmin = user.role === "ADMIN";
  const restrict = matterIds ? Prisma.sql`AND m.id IN (${Prisma.join(matterIds)})` : Prisma.empty;

  const rows = await db.$queryRaw<{ matterId: string; n: number }[]>(Prisma.sql`
    WITH accessible AS (
      SELECT m.id, asg.at AS assigned_at
      FROM "Matter" m
      LEFT JOIN LATERAL (
        SELECT MAX(a."assignedAt") AS at FROM "MatterAssignment" a
        WHERE a."matterId" = m.id AND a."userId" = ${user.id} AND a."removedAt" IS NULL
      ) asg ON true
      WHERE m."deletedAt" IS NULL ${restrict}
        AND ((${isAdmin} AND m."organizationId" = ${user.organizationId}) OR asg.at IS NOT NULL)
    )
    SELECT c.id AS "matterId", COUNT(msg.id)::int AS n
    FROM accessible c
    JOIN "MatterMessage" msg ON msg."matterId" = c.id
    LEFT JOIN "MatterChatRead" r ON r."matterId" = c.id AND r."userId" = ${user.id}
    WHERE msg."authorId" <> ${user.id}
      AND msg."deletedAt" IS NULL
      AND msg."createdAt" > COALESCE(r."lastReadAt", c.assigned_at, (SELECT u."createdAt" FROM "User" u WHERE u.id = ${user.id}))
    GROUP BY c.id
  `);
  return new Map(rows.map((r) => [r.matterId, r.n]));
}

/** Everything unread across the case threads you can open plus the department channel (the sidebar chip). */
export async function getTotalUnread(user: Who): Promise<number> {
  const [byCase, department] = await Promise.all([getUnreadCounts(user), getDepartmentUnread(user)]);
  let total = department;
  for (const n of byCase.values()) total += n;
  return total;
}

/** When this person last read the thread (see the note above for the no-row default). */
export async function getLastReadAt(user: Who, matterId: string): Promise<Date> {
  const read = await db.matterChatRead.findUnique({
    where: { userId_matterId: { userId: user.id, matterId } },
    select: { lastReadAt: true },
  });
  if (read) return read.lastReadAt;
  const [assignment, account] = await Promise.all([
    db.matterAssignment.findFirst({ where: { matterId, userId: user.id, removedAt: null }, orderBy: { assignedAt: "desc" }, select: { assignedAt: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
  ]);
  return assignment?.assignedAt ?? account?.createdAt ?? new Date(0);
}

/**
 * Marks the thread read up to now, and clears this thread's chat notifications from the bell
 * (you have now seen them). Not audited: it is per-person view state, written on every open.
 */
export async function markThreadRead(userId: string, matterId: string) {
  const now = new Date();
  await db.$transaction([
    db.matterChatRead.upsert({
      where: { userId_matterId: { userId, matterId } },
      create: { userId, matterId, lastReadAt: now },
      update: { lastReadAt: now },
    }),
    db.notification.updateMany({
      where: { userId, matterId, readAt: null, type: { in: ["CASE_MESSAGE", "MESSAGE_REPLY", "MESSAGE_MENTION"] } },
      data: { readAt: now },
    }),
  ]);
}
