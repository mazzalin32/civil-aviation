/**
 * Pure date logic for the job runner — no database, so it is unit-tested on its own (due.test.ts).
 *
 * Every reminder is decided on Kampala *calendar days* (CLAUDE.md: stored UTC, shown Africa/Kampala),
 * never on raw hours, so "1 day before" means "the day before, in Kampala", whatever time the hearing is.
 */
import { APP_TIME_ZONE } from "../time";

/** A Kampala calendar day as "YYYY-MM-DD". */
export type Day = string;

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "numeric", hourCycle: "h23" });

export function kampalaDay(date: Date): Day {
  return dayFormat.format(date);
}

export function kampalaHour(date: Date): number {
  return Number(hourFormat.format(date));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Day, to: Day): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(day: Day, n: number): Day {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Which reminder of a "before the date" schedule is due, `daysUntil` days ahead of the date.
 * Offsets are days before (positive), the day itself (0) or days after (negative, e.g. overdue).
 *
 * The answer is the *latest* stage already reached: the smallest offset ≥ daysUntil. So a hearing
 * added only 2 days ahead gets the 7-day stage now (worded "in 2 days"), then the 1-day stage —
 * never the stages it skipped, and never a stage twice (the caller dedupes per stage).
 * Undefined = nothing due yet.
 */
export function dueStageBefore(offsets: number[], daysUntil: number): number | undefined {
  const reached = offsets.filter((o) => o >= daysUntil);
  return reached.length ? Math.min(...reached) : undefined;
}

/**
 * Which stage of a "looking back" schedule is due, `daysSince` days after the date (outcome
 * missing, case inactive). These offsets only ever mean "after", so their sign is ignored.
 * The answer is the largest offset already passed; undefined = too early.
 */
export function dueStageAfter(offsets: number[], daysSince: number): number | undefined {
  const passed = offsets.map(Math.abs).filter((o) => o <= daysSince);
  return passed.length ? Math.max(...passed) : undefined;
}

/** "today" / "tomorrow" / "in 3 days" / "yesterday" / "3 days ago". */
export function relativeDay(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  if (daysUntil === -1) return "yesterday";
  return daysUntil > 0 ? `in ${daysUntil} days` : `${-daysUntil} days ago`;
}

/** "1 day" / "3 days". */
export function dayCount(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? "day" : "days"}`;
}
