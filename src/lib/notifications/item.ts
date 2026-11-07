import { currentNotificationUrl } from "./links";

/** The shape a notification has on the wire (server action result and SSE event) and in the bell. */
export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  url: string | null;
  /** Case/contract reference (e.g. "UCAA/LIT/2026/0004") for the chip, when the notification is about one. */
  reference: string | null;
  readAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  type: string;
  message: string;
  url: string | null;
  readAt: Date | null;
  createdAt: Date;
  matter?: { reference: string } | null;
  contract?: { reference: string } | null;
};

export const NOTIFICATION_INCLUDE = {
  matter: { select: { reference: true } },
  contract: { select: { reference: true } },
} as const;

export function toNotificationItem(row: Row): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    url: currentNotificationUrl(row.url),
    reference: row.matter?.reference ?? row.contract?.reference ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
