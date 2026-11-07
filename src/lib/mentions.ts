/**
 * Chat stores a mention as `@[Agnes Nakato](user:cmw68…)` so it can be resolved to a user.
 * Anywhere that text is shown outside the chat itself (notification bell, emails, previews)
 * the id is noise — show `@Agnes Nakato`. Pure, so it runs on the server and in client components.
 */
const FULL_TOKEN = /@\[([^\]]+)\]\(user:[^)]*\)/g;
// A token cut off by a character limit, e.g. "…@[Agnes Nakato](user:cmw68te" at the end of a string.
const TRUNCATED_TOKEN = /@\[([^\]]+)\]\(user:[^)]*$/;
const DANGLING_OPEN = /@\[[^\]]*$/;

export function stripMentionTokens(text: string): string {
  return text.replace(FULL_TOKEN, "@$1").replace(TRUNCATED_TOKEN, "@$1").replace(DANGLING_OPEN, "").replace(/\s+/g, " ").trim();
}

/** Plain-text preview of a chat body: tokens resolved to names *first*, then cut to `max`
 *  characters — cutting first is what split a token in half and leaked the user id. */
export function previewText(body: string, max = 120): string {
  const plain = stripMentionTokens(body);
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
