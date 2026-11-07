"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessMatterChat, canEditMatter } from "@/lib/authz";
import { isMatterChatReadOnly } from "@/lib/chat/rules";
import { getMentionableUsers, loadMessagePage, loadMessagePageUntil, type Mentionable } from "@/lib/chat/messages";
import type {
  SerializedChatMessage,
} from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import type { LinkableDocument } from "@/app/(app)/cases/[id]/tabs/attach-document-dialog";

export type CaseChatData = {
  /** The latest page of the thread (plus every pinned message), oldest first. */
  messages: SerializedChatMessage[];
  /** Older history exists; pass `cursor` to loadEarlierCaseMessages. */
  hasMoreEarlier: boolean;
  cursor: string | null;
  caseDocuments: LinkableDocument[];
  team: { id: string; name: string; role: string }[];
  /** Who can be @mentioned: the people who can open this chat (assigned lawyers + org Admins). */
  mentionable: Mentionable[];
  canPin: boolean;
  /** Closed matter: nobody can post, pin or delete. */
  readOnly: boolean;
  isAdmin: boolean;
};

/** Everything the chat UI needs for one case, after the same access checks the stream and download routes apply. */
export async function getCaseChatData(
  matterId: string,
  /** Make sure this message is in the returned page (deep link from a notification). */
  ensureMessageId?: string,
): Promise<{ error?: string; data?: CaseChatData }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Authentication required." };

  const matterOrg = await db.matter.findUnique({ where: { id: matterId }, select: { organizationId: true } });
  if (!matterOrg || matterOrg.organizationId !== user.organizationId) return { error: "Case not found." };

  const allowed = await canAccessMatterChat(user.id, user.role, matterId);
  if (!allowed) {
    return { error: "You are not assigned to this case." };
  }

  const [matter, page, rawDocuments, mentionable] = await Promise.all([
    db.matter.findUnique({
      where: { id: matterId },
      include: {
        assignments: {
          where: { removedAt: null },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    ensureMessageId ? loadMessagePageUntil(matterId, ensureMessageId) : loadMessagePage(matterId),
    db.document.findMany({
      where: { matterId, deletedAt: null },
      include: {
        folder: true,
        currentVersion: { select: { size: true } },
      },
      orderBy: { name: "asc" },
    }),
    getMentionableUsers(matterId, matterOrg.organizationId),
  ]);

  if (!matter) return { error: "Case not found." };

  const canPin = await canEditMatter(user.id, user.role, matterId);
  const team = matter.assignments.map((a) => ({
    id: a.user.id,
    name: a.user.name,
    role: a.role,
  }));

  const caseDocuments: LinkableDocument[] = rawDocuments.map((d) => ({
    id: d.id,
    name: d.name,
    folderName: d.folder.name,
    size: d.currentVersion?.size ?? null,
  }));

  return {
    data: {
      messages: page.messages,
      hasMoreEarlier: page.hasMore,
      cursor: page.cursor,
      caseDocuments,
      team,
      mentionable,
      canPin,
      readOnly: isMatterChatReadOnly(matter.status),
      isAdmin: user.role === "ADMIN",
    },
  };
}
