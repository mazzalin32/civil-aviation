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

/** Money is stored as integer UGX. */
export function formatUGX(amount: number | bigint) {
  return `UGX ${new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 0 }).format(amount)}`;
}
