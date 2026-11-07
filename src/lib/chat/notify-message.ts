import "server-only";
import { db } from "../db";
import { notify } from "../notify";
import { previewText } from "../mentions";
import { chatMessageUrl, chatThreadUrl } from "../notifications/links";
import { publishNotification } from "../notifications/event-bus";
import { NOTIFICATION_INCLUDE, toNotificationItem } from "../notifications/item";

type Input = {
  matter: { id: string; title: string; reference: string };
  author: { id: string; name: string };
  message: { id: string; body: string };
  /** Already validated: people who can open this chat and were @mentioned. */
  mentionedIds: string[];
  /** Author of the message being replied to, if any. */
  replyToAuthorId: string | null;
  /** Everyone who can open this chat (assigned lawyers + Admins), the author included. */
  participantIds: string[];
};

/**
 * Tells the right people about a new case message — each person hears about it once, in the
 * most specific way: @mentioned → "mentioned you"; replied to → "replied to you"; otherwise a
 * quiet "new message" that collapses with their earlier unread ones instead of stacking up.
 */
export async function notifyThreadActivity({ matter, author, message, mentionedIds, replyToAuthorId, participantIds }: Input) {
  const mentioned = new Set(mentionedIds.filter((id) => id !== author.id));
  const preview = previewText(message.body, 120);

  for (const userId of mentioned) {
    await notify({
      userId,
      type: "MESSAGE_MENTION",
      deferEmailUntilUnread: true,
      matterId: matter.id,
      subject: `Mentioned in ${matter.reference}`,
      message: `${author.name} mentioned you in ${matter.title}: "${preview}"`,
      url: chatMessageUrl(matter.id, message.id),
      payload: { matterId: matter.id, messageId: message.id },
    });
  }

  const replyTarget = replyToAuthorId && replyToAuthorId !== author.id && !mentioned.has(replyToAuthorId) ? replyToAuthorId : null;
  if (replyTarget) {
    await notify({
      userId: replyTarget,
      type: "MESSAGE_REPLY",
      deferEmailUntilUnread: true,
      matterId: matter.id,
      subject: `Reply in ${matter.reference}`,
      message: `${author.name} replied to you in ${matter.title}: "${preview}"`,
      url: chatMessageUrl(matter.id, message.id),
      payload: { matterId: matter.id, messageId: message.id },
    });
  }

  const others = participantIds.filter((id) => id !== author.id && !mentioned.has(id) && id !== replyTarget);
  for (const userId of others) await notifyNewMessage(userId, matter, author.name, preview, message.id);
}

/**
 * "New message" for one person. If they already have an unread one for this matter, update it to
 * "N new messages" (and push it live again) rather than adding a row per message.
 */
async function notifyNewMessage(
  userId: string,
  matter: { id: string; title: string },
  authorName: string,
  preview: string,
  messageId: string,
) {
  const existing = await db.notification.findFirst({
    where: { userId, matterId: matter.id, type: "CASE_MESSAGE", readAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!existing) {
    await notify({
      userId,
      type: "CASE_MESSAGE",
      deferEmailUntilUnread: true,
      matterId: matter.id,
      subject: `New message in ${matter.title}`,
      message: `${authorName} in ${matter.title}: "${preview}"`,
      url: chatThreadUrl(matter.id),
      payload: { matterId: matter.id, messageId, count: 1 },
    });
    return;
  }

  // They may have muted this kind of notification since the earlier one was created.
  const pref = await db.notificationPreference.findUnique({ where: { userId_type: { userId, type: "CASE_MESSAGE" } } });
  if (pref && !pref.inApp) return;

  const count = ((existing.payload as { count?: number } | null)?.count ?? 1) + 1;
  const updated = await db.notification.update({
    where: { id: existing.id },
    data: {
      message: `${count} new messages in ${matter.title}`,
      payload: { matterId: matter.id, messageId, count },
      createdAt: new Date(), // surfaces at the top of the bell again
    },
    include: NOTIFICATION_INCLUDE,
  });
  publishNotification(userId, toNotificationItem(updated));
}
