"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessMatterChat, canEditMatter } from "@/lib/authz";
import type {
  SerializedChatMessage,
} from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import type { LinkableDocument } from "@/app/(app)/cases/[id]/tabs/attach-document-dialog";

export type CaseChatData = {
  messages: SerializedChatMessage[];
  caseDocuments: LinkableDocument[];
  team: { id: string; name: string; role: string }[];
  canPin: boolean;
};

export async function getCaseChatData(
  matterId: string
): Promise<{ error?: string; data?: CaseChatData }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Authentication required." };

  const matterOrg = await db.matter.findUnique({ where: { id: matterId }, select: { organizationId: true } });
  if (!matterOrg || matterOrg.organizationId !== user.organizationId) return { error: "Case not found." };

  const allowed = await canAccessMatterChat(user.id, user.role, matterId);
  if (!allowed) {
    return { error: "You are not assigned to this case." };
  }

  const [matter, rawMessages, rawDocuments] = await Promise.all([
    db.matter.findUnique({
      where: { id: matterId },
      include: {
        assignments: {
          where: { removedAt: null },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    db.matterMessage.findMany({
      where: { matterId },
      include: {
        author: { select: { id: true, name: true } },
        pinnedBy: { select: { id: true, name: true } },
        attachments: true,
        mentions: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.document.findMany({
      where: { matterId, deletedAt: null },
      include: {
        folder: true,
        currentVersion: { select: { size: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!matter) return { error: "Case not found." };

  const canPin = await canEditMatter(user.id, user.role, matterId);
  const team = matter.assignments.map((a) => ({
    id: a.user.id,
    name: a.user.name,
    role: a.role,
  }));

  const messages: SerializedChatMessage[] = rawMessages.map((m) => ({
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
    attachments: m.attachments.map((att) => ({
      id: att.id,
      name: att.name,
      size: att.size,
      mimeType: att.mimeType,
      isLinkedDocument: Boolean(att.documentId),
      documentId: att.documentId,
      downloadUrl: `/api/cases/${matter.id}/chat/attachments/${att.id}/download`,
    })),
    mentions: m.mentions.map((men) => ({
      userId: men.user.id,
      userName: men.user.name,
    })),
  }));

  const caseDocuments: LinkableDocument[] = rawDocuments.map((d) => ({
    id: d.id,
    name: d.name,
    folderName: d.folder.name,
    size: d.currentVersion?.size ?? null,
  }));

  return {
    data: {
      messages,
      caseDocuments,
      team,
      canPin,
    },
  };
}
