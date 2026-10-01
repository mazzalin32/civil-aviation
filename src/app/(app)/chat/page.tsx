import { db } from "@/lib/db";
import { requireRole, canEditMatter } from "@/lib/authz";
import { CaseChatHub, type CaseConversationSummary } from "./chat-hub";
import type { CaseChatData } from "./actions";

export const metadata = { title: "Case Chat" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole();
  const isAdmin = user.role === "ADMIN";

  // Per user requirement:
  // Strictly scoped per case — assigned counsel + admins
  const matters = await db.matter.findMany({
    where: isAdmin
      ? { deletedAt: null }
      : {
          deletedAt: null,
          assignments: {
            some: {
              userId: user.id,
              removedAt: null,
            },
          },
        },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      priority: true,
      lastActivityAt: true,
      category: { select: { name: true } },
      assignments: {
        where: { removedAt: null },
        select: {
          role: true,
          user: { select: { id: true, name: true } },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
          attachments: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          messages: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { lastActivityAt: "desc" },
  });

  // Sort: matters with the most recent chat message float to the top
  const sortedMatters = [...matters].sort((a, b) => {
    const aTime = a.messages[0]?.createdAt?.getTime() ?? a.lastActivityAt.getTime();
    const bTime = b.messages[0]?.createdAt?.getTime() ?? b.lastActivityAt.getTime();
    return bTime - aTime;
  });

  const conversationSummaries: CaseConversationSummary[] = sortedMatters.map((m) => {
    const last = m.messages[0] ?? null;
    return {
      id: m.id,
      reference: m.reference,
      title: m.title,
      status: m.status,
      priority: m.priority,
      categoryName: m.category.name,
      assignedLawyers: m.assignments.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        role: a.role,
      })),
      lastMessage: last
        ? {
            id: last.id,
            body: last.body,
            createdAt: last.createdAt.toISOString(),
            authorName: last.author.name,
            authorId: last.author.id,
            hasAttachments: last.attachments.length > 0,
          }
        : null,
      messageCount: m._count.messages,
    };
  });

  // Determine initial selected case
  const sp = await searchParams;
  const requestedCaseId = typeof sp?.caseId === "string" ? sp.caseId : undefined;
  const isAccessible = requestedCaseId
    ? conversationSummaries.some((c) => c.id === requestedCaseId)
    : false;

  const selectedCaseId = isAccessible
    ? requestedCaseId!
    : conversationSummaries[0]?.id ?? null;

  let initialChatData: CaseChatData | null = null;

  if (selectedCaseId) {
    const [rawMessages, rawDocuments, canPin, selectedMatter] = await Promise.all([
      db.matterMessage.findMany({
        where: { matterId: selectedCaseId },
        include: {
          author: { select: { id: true, name: true } },
          pinnedBy: { select: { id: true, name: true } },
          attachments: true,
          mentions: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.document.findMany({
        where: { matterId: selectedCaseId, deletedAt: null },
        include: {
          folder: true,
          currentVersion: { select: { size: true } },
        },
        orderBy: { name: "asc" },
      }),
      canEditMatter(user.id, user.role, selectedCaseId),
      db.matter.findUnique({
        where: { id: selectedCaseId },
        select: {
          assignments: {
            where: { removedAt: null },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);

    const team = (selectedMatter?.assignments ?? []).map((a) => ({
      id: a.user.id,
      name: a.user.name,
      role: a.role,
    }));

    initialChatData = {
      messages: rawMessages.map((m) => ({
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
          downloadUrl: `/api/cases/${selectedCaseId}/chat/attachments/${att.id}/download`,
        })),
        mentions: m.mentions.map((men) => ({
          userId: men.user.id,
          userName: men.user.name,
        })),
      })),
      caseDocuments: rawDocuments.map((d) => ({
        id: d.id,
        name: d.name,
        folderName: d.folder.name,
        size: d.currentVersion?.size ?? null,
      })),
      team,
      canPin,
    };
  }

  // Active lawyers for @mentions
  const allLawyers = await db.user.findMany({
    where: { role: "LAWYER", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-mt-1 -mb-6">
      <CaseChatHub
        currentUserId={user.id}
        currentUserRole={user.role}
        allCases={conversationSummaries}
        initialSelectedCaseId={selectedCaseId}
        initialChatData={initialChatData}
        allLawyers={allLawyers}
      />
    </div>
  );
}
