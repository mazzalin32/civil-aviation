import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { orgId } from "@/lib/org";
import { getUnreadCounts } from "@/lib/chat/unread";
import { getDepartmentLastMessage, getDepartmentUnread } from "@/lib/chat/department";
import { getDepartmentChatData, type DepartmentChatData } from "./department-actions";
import { CaseChatHub, type CaseConversationSummary, type DepartmentSummary } from "./chat-hub";
import { getCaseChatData, type CaseChatData } from "./actions";

export const metadata = { title: "Case Chat" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN", "LAWYER"); // the Chat page is for an organisation's own staff
  const isAdmin = user.role === "ADMIN";

  // Per user requirement:
  // Strictly scoped per case — assigned counsel + admins
  const matters = await db.matter.findMany({
    where: isAdmin
      ? { deletedAt: null, organizationId: orgId(user.organizationId) }
      : {
          deletedAt: null,
          organizationId: orgId(user.organizationId),
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

  const unread = await getUnreadCounts(user, sortedMatters.map((m) => m.id));

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
      unreadCount: unread.get(m.id) ?? 0,
    };
  });

  // The department channel's line in the list (newest message + your unread count).
  const [departmentLast, departmentUnread] = await Promise.all([
    user.organizationId ? getDepartmentLastMessage(user.organizationId) : null,
    getDepartmentUnread(user),
  ]);
  const departmentSummary: DepartmentSummary = {
    unreadCount: departmentUnread,
    lastMessage: departmentLast
      ? {
          id: departmentLast.id,
          body: departmentLast.body,
          createdAt: departmentLast.createdAt.toISOString(),
          authorName: departmentLast.author.name,
          authorId: departmentLast.author.id,
          hasAttachments: false,
        }
      : null,
  };

  // Determine initial selected case
  const sp = await searchParams;
  const requestedCaseId = typeof sp?.caseId === "string" ? sp.caseId : undefined;
  const isAccessible = requestedCaseId
    ? conversationSummaries.some((c) => c.id === requestedCaseId)
    : false;

  const selectedCaseId = isAccessible
    ? requestedCaseId!
    : conversationSummaries[0]?.id ?? null;

  // ?channel=department opens the department chat; so does having no case conversations at all.
  const initialView: "case" | "department" = sp?.channel === "department" || !selectedCaseId ? "department" : "case";

  // A notification deep-links to one message (?msg=…). Only honoured if it belongs to the opened thread.
  const requestedMessageId = typeof sp?.msg === "string" ? sp.msg : undefined;

  // Same loaders (and same access checks) the hub uses when you switch conversations.
  const initialChatData: CaseChatData | null =
    initialView === "case" && selectedCaseId ? ((await getCaseChatData(selectedCaseId, requestedMessageId)).data ?? null) : null;
  const initialDepartmentData: DepartmentChatData | null = initialView === "department" ? ((await getDepartmentChatData()).data ?? null) : null;

  const openedMessages = initialView === "department" ? initialDepartmentData?.messages : initialChatData?.messages;
  const highlightMessageId = requestedMessageId && openedMessages?.some((m) => m.id === requestedMessageId) ? requestedMessageId : null;

  return (
    <div className="-mt-1 -mb-6">
      {/* keyed: a notification click is a same-route navigation (/chat → /chat?caseId=…&msg=…); without
          a key the hub keeps its old selected case, because that lives in client state. */}
      <CaseChatHub
        key={`${initialView}:${selectedCaseId ?? "none"}:${highlightMessageId ?? ""}`}
        highlightMessageId={highlightMessageId}
        currentUserId={user.id}
        currentUserRole={user.role}
        allCases={conversationSummaries}
        department={departmentSummary}
        initialView={initialView}
        initialSelectedCaseId={selectedCaseId}
        initialChatData={initialChatData}
        initialDepartmentData={initialDepartmentData}
      />
    </div>
  );
}
