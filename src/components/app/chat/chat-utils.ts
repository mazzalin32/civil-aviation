import { formatDate } from "@/lib/time";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import type { MentionUser } from "./mention-popover";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compact time for the conversation list: "now", "5m", "14:20", "Yest", "Mon", "3 Nov". */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return formatDate(date, { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yest";
  if (diffDays < 7) {
    return formatDate(date, { weekday: "short" });
  }
  return formatDate(date, { day: "numeric", month: "short" });
}

/** "Today" / "Yesterday" / "Monday, 3 Nov" — the separator label above a day's messages. */
export function getDateGroupLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - messageDate.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatDate(date, { weekday: "long", day: "numeric", month: "short" });
}

export function groupMessagesByDay(messages: SerializedChatMessage[]) {
  const groups: { label: string; messages: SerializedChatMessage[] }[] = [];
  for (const msg of messages) {
    const label = getDateGroupLabel(msg.createdAt);
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.messages.push(msg);
    else groups.push({ label, messages: [msg] });
  }
  return groups;
}

/** The first message from someone else posted after you last read the thread — where "New messages" goes. */
export function findFirstUnreadId(messages: SerializedChatMessage[], currentUserId: string, lastReadAt: string): string | null {
  const since = new Date(lastReadAt).getTime();
  return messages.find((m) => !m.deletedAt && m.authorId !== currentUserId && new Date(m.createdAt).getTime() > since)?.id ?? null;
}

/** Scrolls a message into view and briefly outlines it (used when jumping to a quoted original). */
export function flashMessage(messageId: string): boolean {
  const el = document.getElementById(`msg-${messageId}`);
  if (!el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("ring-2", "ring-primary/50");
  setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 1800);
  return true;
}

export function getStatusDotColor(status: string): string {
  switch (status.toUpperCase()) {
    case "OPEN":
    case "ACTIVE":
      return "bg-success";
    case "HEARING":
      return "bg-warning";
    case "CLOSED":
      return "bg-neutral";
    default:
      return "bg-text-muted";
  }
}

/** Case-insensitive match on body, author and attachment names (what the thread search box filters by). */
export function matchesThreadSearch(m: SerializedChatMessage, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    m.body.toLowerCase().includes(q) ||
    m.authorName.toLowerCase().includes(q) ||
    m.attachments.some((a) => a.name.toLowerCase().includes(q))
  );
}

/** People offered by the @-autocomplete: whoever can open the chat, with assigned counsel flagged (sorted first). */
export function toMentionUsers(
  mentionable: { id: string; name: string }[],
  team: { id: string }[],
): MentionUser[] {
  return mentionable.map((l) => ({ id: l.id, name: l.name, isTeamMember: team.some((t) => t.id === l.id) }));
}

/**
 * The composer shows a clean "@Name"; storage needs "@[Name](user:id)". Swaps in the tokens for the
 * people picked from the autocomplete (the server re-derives and validates mentions from this text).
 */
export function serializeMentions(raw: string, tracked: { id: string; name: string }[]): string {
  let body = raw;
  for (const m of tracked) {
    const clean = `@${m.name}`;
    if (body.includes(clean)) body = body.split(clean).join(`@[${m.name}](user:${m.id})`);
  }
  return body;
}
