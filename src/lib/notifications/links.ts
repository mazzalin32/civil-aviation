/** Where a chat-related notification opens: the Chat page on that case's thread, scrolled to the message. */
export function chatMessageUrl(matterId: string, messageId: string) {
  return `/chat?caseId=${matterId}&msg=${messageId}`;
}

// Mention notifications saved before the Chat deep-link existed point at the case's Discussion tab.
const LEGACY_CHAT_URL = /^\/cases\/([^/?#]+)\?tab=discussion#msg-([^/?#]+)$/;

/** Rewrites an old stored link to the current one; anything else passes through untouched. */
export function currentNotificationUrl(url: string | null): string | null {
  if (!url) return url;
  const m = LEGACY_CHAT_URL.exec(url);
  return m ? chatMessageUrl(m[1], m[2]) : url;
}
