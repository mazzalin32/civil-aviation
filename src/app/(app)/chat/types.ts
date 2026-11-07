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
};
