import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { extractMentions, previewText } from "../mentions";
import { departmentChannel } from "./channels";
import { MESSAGE_PAGE_SIZE, REPLY_SNIPPET_CHARS } from "./rules";
import type { MessagePage, Mentionable } from "./messages";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";

/**
 * The department channel (spec §5.14): one organisation-wide thread, separate from the per-case
 * Discussion threads. Everyone who works in the organisation (Admins and lawyers) can read and post;
 * nobody outside it can see it. It reuses the case chat's message shape so the same UI renders both.
 */

export const GROUP_MESSAGE_INCLUDE = {
  author: { select: { id: true, name: true } },
  replyTo: { select: { id: true, body: true, deletedAt: true, author: { select: { name: true } } } },
} as const;

type Row = Prisma.GroupMessageGetPayload<{ include: typeof GROUP_MESSAGE_INCLUDE }>;

export function serializeGroupMessage(m: Row): SerializedChatMessage {
  return {
    id: m.id,
    matterId: departmentChannel(m.organizationId), // the channel key; there is no matter
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    authorId: m.author.id,
    authorName: m.author.name,
    isPinned: false,
    pinnedAt: null,
    pinnedById: null,
    pinnedByName: null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    editedAt: m.editedAt?.toISOString() ?? null,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          authorName: m.replyTo.author.name,
          snippet: m.replyTo.deletedAt ? "" : previewText(m.replyTo.body, REPLY_SNIPPET_CHARS),
          deleted: Boolean(m.replyTo.deletedAt),
        }
      : null,
    attachments: [], // no file attachments in the department channel yet
    // Mentions live in the text itself (no separate table), so they are read back from it.
    mentions: extractMentions(m.body).map((x) => ({ userId: x.id, userName: x.name })),
  };
}

/** One page of the channel; same paging rules as a case thread (latest 50, older on request). */
export async function loadGroupPage(organizationId: string, before?: Date): Promise<MessagePage> {
  const rows = await db.groupMessage.findMany({
    where: { organizationId, ...(before ? { createdAt: { lt: before } } : {}) },
    include: GROUP_MESSAGE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: MESSAGE_PAGE_SIZE + 1,
  });
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  const window = rows.slice(0, MESSAGE_PAGE_SIZE).reverse();
  return {
    messages: window.map(serializeGroupMessage),
    hasMore,
    cursor: window[0]?.createdAt.toISOString() ?? null,
  };
}

/** Everyone who can read and post in the channel — also who can be @mentioned and who gets pinged. */
export async function getDepartmentMembers(organizationId: string): Promise<Mentionable[]> {
  return db.user.findMany({
    where: { organizationId, isActive: true, deletedAt: null, role: { in: ["ADMIN", "LAWYER"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

type Who = { id: string; organizationId: string | null };

/** When this person last read the channel; with no marker, the day their account was created. */
export async function getDepartmentLastReadAt(user: Who): Promise<Date> {
  if (!user.organizationId) return new Date(0);
  const read = await db.groupChatRead.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: user.organizationId } },
    select: { lastReadAt: true },
  });
  if (read) return read.lastReadAt;
  const account = await db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } });
  return account?.createdAt ?? new Date(0);
}

export async function getDepartmentUnread(user: Who): Promise<number> {
  if (!user.organizationId) return 0;
  const since = await getDepartmentLastReadAt(user);
  return db.groupMessage.count({
    where: { organizationId: user.organizationId, authorId: { not: user.id }, deletedAt: null, createdAt: { gt: since } },
  });
}

/** The newest visible message, for the conversation list's preview line. */
export async function getDepartmentLastMessage(organizationId: string) {
  return db.groupMessage.findFirst({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  });
}

/** Marks the channel read, and clears its mention/reply entries from the bell. Not audited: per-person view state. */
export async function markDepartmentRead(userId: string, organizationId: string) {
  const now = new Date();
  await db.$transaction([
    db.groupChatRead.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      create: { userId, organizationId, lastReadAt: now },
      update: { lastReadAt: now },
    }),
    db.notification.updateMany({
      where: { userId, readAt: null, type: { in: ["MESSAGE_REPLY", "MESSAGE_MENTION"] }, url: { startsWith: "/chat?channel=department" } },
      data: { readAt: now },
    }),
  ]);
}
