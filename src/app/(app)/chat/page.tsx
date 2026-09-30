import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { ChatView } from "./chat-view";

export const metadata = { title: "Group Chat" };

export default async function ChatPage() {
  const user = await requireRole();

  const messages = await db.groupMessage.findMany({
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return (
    <>
      <PageHeader title="Group Chat" />
      <ChatView
        currentUserId={user.id}
        messages={messages.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), authorId: m.author.id, authorName: m.author.name }))}
      />
    </>
  );
}
