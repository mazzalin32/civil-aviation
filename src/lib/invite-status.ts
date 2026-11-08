/**
 * The account status Admins see on Users (and Superadmin on an organisation's Admins).
 * Pure — no database — so the list, the detail page, the export and the tests share it.
 *
 * - Deactivated: switched off by an Admin (or a rolled-back import / auto-lock).
 * - Active: has set a password (a credential account exists).
 * - Invited: no password yet, and their newest link still works.
 * - Invite expired: no password yet, and no working link — the Admin needs to resend.
 */
export type AccountStatusKey = "deactivated" | "active" | "invited" | "expired";

export type InviteLink = { sentAt: Date; expiresAt: Date };

export type AccountStatus = {
  key: AccountStatusKey;
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
  /** Short extra line, e.g. "Sent 2 days ago · expires in 1 day". */
  detail: string | null;
  /** Show "Resend invite": the person has never set a password and the account is on. */
  canResend: boolean;
};

const DAY = 86_400_000;
const HOUR = 3_600_000;

function span(ms: number) {
  if (ms < HOUR) {
    const m = Math.max(1, Math.round(ms / 60_000));
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  if (ms < DAY) {
    const h = Math.round(ms / HOUR);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.round(ms / DAY);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/** "today" / "1 day ago" style for the sent time. */
export function sentLabel(sentAt: Date, now: Date) {
  const ms = now.getTime() - sentAt.getTime();
  if (ms < 60_000) return "Sent just now";
  return `Sent ${span(ms)} ago`;
}

/**
 * `lastSentAt` (from the audit log) only matters when the link record itself is gone — Better
 * Auth deletes an expired link the moment someone opens it — so the Admin still sees when the
 * invite last went out.
 */
export function accountStatus(input: { isActive: boolean; hasPassword: boolean; link: InviteLink | null; lastSentAt?: Date | null; now: Date }): AccountStatus {
  const { isActive, hasPassword, link, lastSentAt, now } = input;
  if (!isActive) return { key: "deactivated", label: "Deactivated", tone: "neutral", detail: null, canResend: false };
  if (hasPassword) return { key: "active", label: "Active", tone: "success", detail: null, canResend: false };
  if (link && link.expiresAt.getTime() > now.getTime()) {
    return {
      key: "invited",
      label: "Invited",
      tone: "warning",
      detail: `${sentLabel(link.sentAt, now)} · expires in ${span(link.expiresAt.getTime() - now.getTime())}`,
      canResend: true,
    };
  }
  return {
    key: "expired",
    label: "Invite expired",
    tone: "danger",
    detail: link
      ? `Link expired ${span(now.getTime() - link.expiresAt.getTime())} ago`
      : lastSentAt
        ? `Last sent ${span(Math.max(60_000, now.getTime() - lastSentAt.getTime()))} ago · link no longer works`
        : "No working link",
    canResend: true,
  };
}
