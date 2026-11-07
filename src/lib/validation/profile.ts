import { z } from "zod";

/** One switch on the Profile → Notifications table: a notification type, a channel, on or off. */
export const notificationPreferenceSchema = z.object({
  type: z.string().min(1).max(64),
  channel: z.enum(["inApp", "email"]),
  enabled: z.boolean(),
});

export const digestSchema = z.object({ enabled: z.boolean() });
