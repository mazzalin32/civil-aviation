/** Where a chat-related notification opens: the Chat page on that case's thread, scrolled to the message. */
export function chatMessageUrl(matterId: string, messageId: string) {
  return `/chat?caseId=${matterId}&msg=${messageId}`;
}

/** A case's chat thread, opened at its first unread message. */
export function chatThreadUrl(matterId: string) {
  return `/chat?caseId=${matterId}`;
}

/** Notification types that mean "there is something new to read in a case chat". */
export const CHAT_NOTIFICATION_TYPES = ["CASE_MESSAGE", "MESSAGE_REPLY", "MESSAGE_MENTION"];

/** The case a chat notification opens (`/chat?caseId=…`), or null for any other link. */
export function chatCaseIdFromUrl(url: string | null): string | null {
  return url?.match(/^\/chat\?caseId=([^&#]+)/)?.[1] ?? null;
}

/** Window events that let separate client components react to notifications without extra connections. */
export const NOTIFICATION_EVENT = "caa:notification"; // detail: NotificationItem, fired for each live arrival
export const NOTIFICATIONS_CHANGED_EVENT = "caa:notifications-changed"; // something marked read elsewhere; re-sync

// Mention notifications saved before the Chat deep-link existed point at the case's Discussion tab.
const LEGACY_CHAT_URL = /^\/cases\/([^/?#]+)\?tab=discussion#msg-([^/?#]+)$/;

/** Rewrites an old stored link to the current one; anything else passes through untouched. */
export function currentNotificationUrl(url: string | null): string | null {
  if (!url) return url;
  const m = LEGACY_CHAT_URL.exec(url);
  return m ? chatMessageUrl(m[1], m[2]) : url;
}
