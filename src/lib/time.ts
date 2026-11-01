/** All dates are stored in UTC and displayed in Kampala time (CLAUDE.md conventions). */
export const APP_TIME_ZONE = "Africa/Kampala";
export const APP_LOCALE = "en-UG";

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIME_ZONE, ...options }).format(date);
}

/** Time-of-day greeting in Kampala, addressing the person by their full name — the account
 *  name is often a role ("Head of Legal", "Managing Partner"), and clipping it to a first
 *  word turned that into "Head" (correct-terms §1). */
export function greetingFor(date: Date, fullName: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(date),
  );
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${hello}, ${fullName.trim()}`;
}

/** Short relative label ("2m", "3h", "5d") for recent timestamps; falls back to a date
 *  once it's further back than a week, where "N days" stops being useful at a glance. */
export function timeAgo(date: Date, now: Date = new Date()) {
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDate(date);
}

/** Money is stored as integer UGX. */
export function formatUGX(amount: number | bigint) {
  return `UGX ${new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 0 }).format(amount)}`;
}
