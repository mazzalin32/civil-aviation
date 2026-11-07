import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { sendNotificationEmail } from "./mailer";
import { stripMentionTokens } from "./mentions";
import { publishNotification } from "./notifications/event-bus";
import { NOTIFICATION_INCLUDE, toNotificationItem } from "./notifications/item";

export type NotifyInput = {
  userId: string;
  type: string; // matches NotificationRule.trigger
  matterId?: string | null;
  contractId?: string | null;
  payload: Record<string, unknown>;
  subject: string;
  message: string;
  url?: string;
  /**
   * Chat notifications: don't email now — the job runner emails it after the CHAT_UNREAD_EMAIL
   * delay, and only if it is still unread by then (FLOWS §10, "avoid spam").
   */
  deferEmailUntilUnread?: boolean;
};

/** The rule holding the chat email delay (minutes). Turning its Email channel off stops chat emails entirely. */
export const CHAT_UNREAD_EMAIL_RULE = "CHAT_UNREAD_EMAIL";

type Client = Pick<typeof db, "notificationRule" | "notificationPreference" | "notification" | "user">;

/** When a deferred chat email falls due, or null when chat emails are switched off. */
async function chatEmailDueAt(client: Client): Promise<Date | null> {
  const rule = await client.notificationRule.findUnique({ where: { trigger: CHAT_UNREAD_EMAIL_RULE } });
  if (!rule || !rule.channels.includes("EMAIL")) return null;
  const minutes = Math.max(0, rule.offsets[0] ?? 0);
  return new Date(Date.now() + minutes * 60_000);
}

/**
 * The single entry point for creating a notification (spec §5.9, FLOWS §12) — always an
 * in-app bell entry, plus email when the rule's channels include it and the user hasn't
 * muted that channel. Hearings, deadlines and security alerts are `mutable: false` on their
 * NotificationRule, so a user can never turn those off regardless of preference rows.
 */
export async function notify(input: NotifyInput, client: Client = db) {
  const rule = await client.notificationRule.findUnique({ where: { trigger: input.type } });
  const pref = rule?.mutable ? await client.notificationPreference.findUnique({ where: { userId_type: { userId: input.userId, type: input.type } } }) : null;

  const wantsInApp = pref ? pref.inApp : true;
  const wantsEmail = (pref ? pref.email : true) && (rule ? rule.channels.includes("EMAIL") : false);
  if (!wantsInApp && !wantsEmail) return null;

  // Callers often interpolate chat text; resolve any `@[Name](user:id)` mention tokens once
  // here so neither the bell nor the email ever shows a raw user id.
  const message = stripMentionTokens(input.message);
  const emailDueAt = wantsEmail && input.deferEmailUntilUnread ? await chatEmailDueAt(client) : null;
  const emailNow = wantsEmail && !input.deferEmailUntilUnread;
  if (!wantsInApp && !emailNow && !emailDueAt) return null;

  const created = await client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      matterId: input.matterId ?? null,
      contractId: input.contractId ?? null,
      payload: input.payload as Prisma.InputJsonValue,
      message,
      url: input.url ?? null,
      // Set only once the send actually succeeds below — not here on intent alone, so a
      // real SMTP failure doesn't silently mark itself as delivered.
      emailedAt: null,
      emailDueAt,
    },
    include: NOTIFICATION_INCLUDE,
  });

  // Push to the user's open tabs before the (slower) email send, so the bell updates at once.
  // Quiet in-app preference = no live push either, same as no bell entry.
  if (wantsInApp) publishNotification(input.userId, toNotificationItem(created));

  if (emailNow) {
    const user = await client.user.findUnique({ where: { id: input.userId }, select: { email: true, name: true } });
    if (user) {
      try {
        await sendNotificationEmail(user.email, user.name, stripMentionTokens(input.subject), message, input.url);
        await client.notification.update({ where: { id: created.id }, data: { emailedAt: new Date() } });
      } catch (err) {
        console.error(`notify: email send failed for notification ${created.id} (${input.type} -> ${user.email})`, err);
      }
    }
  }

  return created;
}
