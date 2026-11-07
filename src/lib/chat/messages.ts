import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { previewText } from "../mentions";
import { MESSAGE_PAGE_SIZE, REPLY_SNIPPET_CHARS } from "./rules";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";

/** The single place a MatterMessage row becomes the shape the chat UIs and the SSE stream use. */
export const MESSAGE_INCLUDE = {
  author: { select: { id: true, name: true } },
  pinnedBy: { select: { id: true, name: true } },
  attachments: true,
  mentions: { include: { user: { select: { id: true, name: true } } } },
  replyTo: { select: { id: true, body: true, deletedAt: true, author: { select: { name: true } } } },
} as const;

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows(where: Prisma.MatterMessageWhereInput, opts: { take?: number; desc?: boolean } = {}) {
  return db.matterMessage.findMany({
    where,
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: opts.desc ? "desc" : "asc" },
    take: opts.take,
  });
}

export function serializeMessage(m: Row): SerializedChatMessage {
  return {
    id: m.id,
    matterId: m.matterId,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    authorId: m.author.id,
    authorName: m.author.name,
    isPinned: m.isPinned,
    pinnedAt: m.pinnedAt?.toISOString() ?? null,
    pinnedById: m.pinnedById,
    pinnedByName: m.pinnedBy?.name ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    editedAt: m.editedAt?.toISOString() ?? null,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          authorName: m.replyTo.author.name,
          // A deleted original must not leak its text through a reply's quote.
          snippet: m.replyTo.deletedAt ? "" : previewText(m.replyTo.body, REPLY_SNIPPET_CHARS),
          deleted: Boolean(m.replyTo.deletedAt),
        }
      : null,
    attachments: m.attachments.map((att) => ({
      id: att.id,
      name: att.name,
      size: att.size,
      mimeType: att.mimeType,
      isLinkedDocument: Boolean(att.documentId),
      documentId: att.documentId,
      downloadUrl: `/api/cases/${m.matterId}/chat/attachments/${att.id}/download`,
    })),
    mentions: m.mentions.map((men) => ({ userId: men.user.id, userName: men.user.name })),
  };
}

export type MessagePage = {
  /** Oldest first. */
  messages: SerializedChatMessage[];
  /** More history exists before `cursor`. */
  hasMore: boolean;
  /** createdAt (ISO) of the oldest message in this page's regular window — pass it back as `before`. */
  cursor: string | null;
};

/**
 * One page of a case's thread. The first page (no `before`) is the latest MESSAGE_PAGE_SIZE messages
 * plus every pinned message however old, so the pinned bar is never missing something; a later page
 * is the MESSAGE_PAGE_SIZE messages before the cursor. Clients merge by id, so overlap is harmless.
 */
export async function loadMessagePage(matterId: string, before?: Date): Promise<MessagePage> {
  const windowRows = await loadRows(
    { matterId, ...(before ? { createdAt: { lt: before } } : {}) },
    { take: MESSAGE_PAGE_SIZE + 1, desc: true },
  );
  const hasMore = windowRows.length > MESSAGE_PAGE_SIZE;
  const inWindow = windowRows.slice(0, MESSAGE_PAGE_SIZE).reverse();

  let rows = inWindow;
  if (!before) {
    const pinned = await loadRows({ matterId, isPinned: true, deletedAt: null });
    const have = new Set(inWindow.map((m) => m.id));
    rows = [...pinned.filter((p) => !have.has(p.id)), ...inWindow].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  return {
    messages: rows.map(serializeMessage),
    hasMore,
    cursor: inWindow[0]?.createdAt.toISOString() ?? null,
  };
}

/**
 * The first page, extended with older pages until `messageId` is in it (bounded) — so a notification
 * for an old message can still scroll to it without leaving a gap between it and the newest messages.
 */
export async function loadMessagePageUntil(matterId: string, messageId: string, maxPages = 20): Promise<MessagePage> {
  let page = await loadMessagePage(matterId);
  for (let i = 0; i < maxPages && page.hasMore && page.cursor && !page.messages.some((m) => m.id === messageId); i++) {
    const older = await loadMessagePage(matterId, new Date(page.cursor));
    const seen = new Set(page.messages.map((m) => m.id));
    page = {
      messages: [...older.messages.filter((m) => !seen.has(m.id)), ...page.messages],
      hasMore: older.hasMore,
      cursor: older.cursor ?? page.cursor,
    };
  }
  return page;
}

export type Mentionable = { id: string; name: string };

/**
 * Who can be @mentioned in a case's chat: exactly the people who can open it — the lawyers assigned
 * to the matter plus the organisation's active Admins. Used both to populate the autocomplete and to
 * validate mentions on the server, so a notification never points at a chat the person can't enter.
 */
export async function getMentionableUsers(matterId: string, organizationId: string | null): Promise<Mentionable[]> {
  return db.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      organizationId,
      OR: [{ role: "ADMIN" }, { matterAssignments: { some: { matterId, removedAt: null } } }],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
