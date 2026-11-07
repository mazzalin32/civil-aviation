import "server-only";
import { db } from "../db";
import { sendNotificationEmail } from "../mailer";
import { isDepartmentChatUrl } from "../notifications/links";

/** Bounded per run; anything left over is picked up a minute later. */
const BATCH = 100;

/**
 * FLOWS §10: chat notifications are in-app at once, email only if still unread after the
 * CHAT_UNREAD_EMAIL delay. `notify()` stamps `emailDueAt`; this sends the ones that fell due and are
 * still unread — "unread" meaning both the bell entry and the conversation itself, because someone
 * can read the thread without ever touching the bell.
 */
export async function sendDueChatEmails(now: Date): Promise<number> {
  const due = await db.notification.findMany({
    where: { emailDueAt: { lte: now }, emailedAt: null },
    orderBy: { emailDueAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      type: true,
      message: true,
      url: true,
      readAt: true,
      createdAt: true,
      matterId: true,
      matter: { select: { reference: true } },
      user: { select: { id: true, email: true, name: true, isActive: true, deletedAt: true, organizationId: true } },
    },
  });

  let sent = 0;
  for (const n of due) {
    // Take it off the queue first: only one run (or one app instance) gets to send it.
    const { count } = await db.notification.updateMany({ where: { id: n.id, emailedAt: null, emailDueAt: { not: null } }, data: { emailDueAt: null } });
    if (count !== 1) continue;
    if (n.readAt || !n.user.isActive || n.user.deletedAt) continue;
    if (await conversationReadSince(n.user.id, n.user.organizationId, n.matterId, n.url, n.createdAt)) continue;

    const place = n.matter ? n.matter.reference : "the department chat";
    const subject =
      n.type === "MESSAGE_MENTION" ? `You were mentioned in ${place}` : n.type === "MESSAGE_REPLY" ? `New reply in ${place}` : `Unread messages in ${place}`;
    try {
      await sendNotificationEmail(n.user.email, n.user.name, subject, n.message, n.url ?? undefined);
      await db.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
      sent++;
    } catch (err) {
      // Put it back on the queue so a temporary SMTP failure doesn't lose it.
      await db.notification.update({ where: { id: n.id }, data: { emailDueAt: new Date(Date.now() + 5 * 60_000) } });
      console.error(`jobs: chat email for notification ${n.id} failed, will retry`, err);
    }
  }
  return sent;
}

/** Has the person opened that conversation since this notification was (last) raised? */
async function conversationReadSince(userId: string, organizationId: string | null, matterId: string | null, url: string | null, since: Date) {
  if (matterId) {
    const read = await db.matterChatRead.findUnique({ where: { userId_matterId: { userId, matterId } }, select: { lastReadAt: true } });
    return Boolean(read && read.lastReadAt >= since);
  }
  if (organizationId && isDepartmentChatUrl(url)) {
    const read = await db.groupChatRead.findUnique({ where: { userId_organizationId: { userId, organizationId } }, select: { lastReadAt: true } });
    return Boolean(read && read.lastReadAt >= since);
  }
  return false;
}
