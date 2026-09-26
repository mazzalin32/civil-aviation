/** All dates are stored in UTC and displayed in Kampala time (CLAUDE.md conventions). */
export const APP_TIME_ZONE = "Africa/Kampala";
export const APP_LOCALE = "en-UG";

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIME_ZONE, ...options }).format(date);
}

/** Money is stored as integer UGX. */
export function formatUGX(amount: number | bigint) {
  return `UGX ${new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 0 }).format(amount)}`;
}
