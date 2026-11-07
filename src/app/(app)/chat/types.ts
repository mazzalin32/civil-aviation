/** The department channel's line in the conversation list. */
export type DepartmentSummary = {
  lastMessage: CaseConversationSummary["lastMessage"];
  unreadCount: number;
};

export type CaseConversationSummary = {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  categoryName: string;
  assignedLawyers: { id: string; name: string; role: string }[];
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    authorName: string;
    authorId: string;
    hasAttachments: boolean;
  } | null;
  messageCount: number;
  /** Messages from other people you haven't read yet. */
  unreadCount: number;
};
