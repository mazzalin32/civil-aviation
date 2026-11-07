/**
 * Chat business rules as pure functions — shared by the server actions (which enforce them) and
 * the chat UIs (which use them only to decide which buttons to show; the server is the authority).
 */

/** Authors can delete (and, once built, edit) their own message for this long (FLOWS §10 step 4). */
export const MESSAGE_EDIT_WINDOW_MINUTES = 15;

/** Messages loaded per page; older history loads on demand. */
export const MESSAGE_PAGE_SIZE = 50;

/** A closed matter's discussion is read-only (FLOWS §10 step 5). */
export const CLOSED_CHAT_MESSAGE = "This matter is closed — its discussion is read-only.";

export function isMatterChatReadOnly(status: string) {
  return status === "CLOSED";
}

export function withinEditWindow(createdAt: Date | string, now: Date = new Date()) {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return now.getTime() - created.getTime() <= MESSAGE_EDIT_WINDOW_MINUTES * 60_000;
}

export type DeleteCheck = { ok: true } | { ok: false; error: string };

/**
 * Who may delete a message: its author for the first 15 minutes, or an Admin at any time
 * (moderation — the deletion is soft and audited either way). Nobody once the matter is closed.
 */
export function checkCanDeleteMessage(input: {
  isAuthor: boolean;
  isAdmin: boolean;
  createdAt: Date | string;
  matterStatus: string;
  now?: Date;
}): DeleteCheck {
  if (isMatterChatReadOnly(input.matterStatus)) return { ok: false, error: CLOSED_CHAT_MESSAGE };
  if (input.isAdmin) return { ok: true };
  if (!input.isAuthor) return { ok: false, error: "You can only delete your own messages." };
  if (!withinEditWindow(input.createdAt, input.now)) {
    return { ok: false, error: `Messages can only be deleted within ${MESSAGE_EDIT_WINDOW_MINUTES} minutes of sending.` };
  }
  return { ok: true };
}
