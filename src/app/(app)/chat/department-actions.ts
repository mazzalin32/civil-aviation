"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { extractMentionIds, previewText } from "@/lib/mentions";
import { chatDepartmentUrl } from "@/lib/notifications/links";
import { chatEventBus } from "@/lib/chat/event-bus";
import { departmentChannel } from "@/lib/chat/channels";
import { checkCanDeleteMessage, checkCanEditMessage } from "@/lib/chat/rules";
import {
  GROUP_MESSAGE_INCLUDE,
  getDepartmentLastReadAt,
  getDepartmentMembers,
  loadGroupPage,
  markDepartmentRead,
  serializeGroupMessage,
} from "@/lib/chat/department";
import { notifyDepartmentActivity } from "@/lib/chat/notify-department";
import type { Mentionable, MessagePage } from "@/lib/chat/messages";
import type { ActionResult, SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";

export type DepartmentChatData = {
  messages: SerializedChatMessage[];
  hasMoreEarlier: boolean;
  cursor: string | null;
  /** Everyone in the channel — also who can be @mentioned. */
  members: Mentionable[];
  isAdmin: boolean;
  /** How far you had read before opening (ISO). */
  lastReadAt: string;
};

const bodySchema = z.string().trim().max(4000, "Message cannot exceed 4000 characters");
const postSchema = z.object({ body: bodySchema, replyToId: z.string().min(1).nullish() });
const editSchema = z.object({ messageId: z.string().min(1), body: bodySchema });
const idSchema = z.object({ messageId: z.string().min(1) });
const earlierSchema = z.object({ before: z.string().datetime() });

/** The department channel belongs to an organisation's own staff: Admins and lawyers, never another org. */
async function requireMember() {
  const user = await requireRole("ADMIN", "LAWYER");
  if (!user.organizationId) redirect("/forbidden");
  return { user, organizationId: user.organizationId };
}

export async function getDepartmentChatData(): Promise<{ error?: string; data?: DepartmentChatData }> {
  const { user, organizationId } = await requireMember();
  const [page, members, lastReadAt] = await Promise.all([
    loadGroupPage(organizationId),
    getDepartmentMembers(organizationId),
    getDepartmentLastReadAt(user),
  ]);
  return {
    data: {
      messages: page.messages,
      hasMoreEarlier: page.hasMore,
      cursor: page.cursor,
      members,
      isAdmin: user.role === "ADMIN",
      lastReadAt: lastReadAt.toISOString(),
    },
  };
}

export async function postDepartmentMessage(raw: unknown): Promise<ActionResult<SerializedChatMessage>> {
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  const { body, replyToId } = parsed.data;
  if (!body) return { error: "Write a message." };

  const { user, organizationId } = await requireMember();
  const members = await getDepartmentMembers(organizationId);
  const memberIds = new Set(members.map((m) => m.id));
  const mentionedIds = extractMentionIds(body).filter((id) => memberIds.has(id));

  const replyTarget = replyToId
    ? await db.groupMessage.findFirst({ where: { id: replyToId, organizationId }, select: { id: true, authorId: true } })
    : null;
  if (replyToId && !replyTarget) return { error: "The message you are replying to no longer exists." };

  const created = await db.groupMessage.create({
    data: { organizationId, authorId: user.id, body, replyToId: replyTarget?.id ?? null },
    include: GROUP_MESSAGE_INCLUDE,
  });

  await writeAudit({
    userId: user.id,
    action: "groupMessage.post",
    entity: "GroupMessage",
    entityId: created.id,
    after: { mentionsCount: mentionedIds.length, replyToId: replyTarget?.id ?? null },
  });

  await notifyDepartmentActivity({
    author: { id: user.id, name: user.name },
    message: { id: created.id, body },
    mentionedIds,
    replyToAuthorId: replyTarget?.authorId ?? null,
    memberIds: members.map((m) => m.id),
  });

  const serialized = serializeGroupMessage(created);
  chatEventBus.publish({ type: "message.created", matterId: departmentChannel(organizationId), data: serialized });
  revalidatePath("/chat");
  return { data: serialized };
}

/** Edit your own message within the edit window; newly @mentioned people are notified. Audited with before/after. */
export async function editDepartmentMessage(raw: unknown): Promise<ActionResult<SerializedChatMessage>> {
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid edit." };
  const { messageId, body } = parsed.data;
  if (!body) return { error: "A message needs some text." };

  const { user, organizationId } = await requireMember();
  const message = await db.groupMessage.findFirst({ where: { id: messageId, organizationId } });
  if (!message || message.deletedAt) return { error: "Message not found." };

  const allowed = checkCanEditMessage({ isAuthor: message.authorId === user.id, createdAt: message.createdAt, matterStatus: "OPEN" });
  if (!allowed.ok) return { error: allowed.error };
  if (body === message.body) return { error: "Nothing changed." };

  const members = await getDepartmentMembers(organizationId);
  const memberIds = new Set(members.map((m) => m.id));
  const before = new Set(extractMentionIds(message.body));
  const newlyMentioned = extractMentionIds(body).filter((id) => memberIds.has(id) && !before.has(id) && id !== user.id);

  const updated = await db.groupMessage.update({
    where: { id: messageId },
    data: { body, editedAt: new Date() },
    include: GROUP_MESSAGE_INCLUDE,
  });

  await writeAudit({ userId: user.id, action: "groupMessage.edit", entity: "GroupMessage", entityId: messageId, before: { body: message.body }, after: { body } });

  for (const userId of newlyMentioned) {
    await notify({
      userId,
      type: "MESSAGE_MENTION",
      subject: "Mentioned in the department chat",
      message: `${user.name} mentioned you in the department chat: "${previewText(body, 120)}"`,
      url: chatDepartmentUrl(messageId),
      payload: { channel: "department", messageId },
    });
  }

  const serialized = serializeGroupMessage(updated);
  chatEventBus.publish({ type: "message.edited", matterId: departmentChannel(organizationId), data: serialized });
  revalidatePath("/chat");
  return { data: serialized };
}

/** Soft delete: the author for 15 minutes, or an Admin at any time (moderation). Audited. */
export async function deleteDepartmentMessage(raw: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid request." };
  const { messageId } = parsed.data;

  const { user, organizationId } = await requireMember();
  const message = await db.groupMessage.findFirst({ where: { id: messageId, organizationId } });
  if (!message || message.deletedAt) return { error: "Message not found." };

  const allowed = checkCanDeleteMessage({
    isAuthor: message.authorId === user.id,
    isAdmin: user.role === "ADMIN",
    createdAt: message.createdAt,
    matterStatus: "OPEN",
  });
  if (!allowed.ok) return { error: allowed.error };

  await db.groupMessage.update({ where: { id: messageId }, data: { deletedAt: new Date(), deletedById: user.id } });
  await writeAudit({ userId: user.id, action: "groupMessage.delete", entity: "GroupMessage", entityId: messageId });

  chatEventBus.publish({ type: "message.deleted", matterId: departmentChannel(organizationId), data: { messageId } });
  revalidatePath("/chat");
  return {};
}

export async function loadEarlierDepartmentMessages(raw: unknown): Promise<ActionResult<MessagePage>> {
  const parsed = earlierSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid request." };
  const { organizationId } = await requireMember();
  return { data: await loadGroupPage(organizationId, new Date(parsed.data.before)) };
}

/** Marks the channel read for the signed-in user (clears its unread count and mention/reply bell entries). */
export async function markDepartmentChatRead(): Promise<ActionResult> {
  const { user, organizationId } = await requireMember();
  await markDepartmentRead(user.id, organizationId);
  revalidatePath("/", "layout"); // refreshes the sidebar's unread chip
  return {};
}
