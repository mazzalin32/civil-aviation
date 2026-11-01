import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { sendNotificationEmail } from "./mailer";

export type NotifyInput = {
  userId: string;
  type: string; // matches NotificationRule.trigger
  matterId?: string | null;
  contractId?: string | null;
  payload: Record<string, unknown>;
  subject: string;
  message: string;
  url?: string;
};

type Client = Pick<typeof db, "notificationRule" | "notificationPreference" | "notification" | "user">;

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

  const created = await client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      matterId: input.matterId ?? null,
      contractId: input.contractId ?? null,
      payload: input.payload as Prisma.InputJsonValue,
      message: input.message,
      url: input.url ?? null,
      emailedAt: wantsEmail ? new Date() : null,
    },
  });

  if (wantsEmail) {
    const user = await client.user.findUnique({ where: { id: input.userId }, select: { email: true, name: true } });
    if (user) await sendNotificationEmail(user.email, user.name, input.subject, input.message, input.url).catch(() => {});
  }

  return created;
}
