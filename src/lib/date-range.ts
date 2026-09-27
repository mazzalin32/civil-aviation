import { APP_TIME_ZONE } from "./time";

export type TimePreset = "today" | "week" | "month" | "quarter" | "year" | "custom";

/** Kampala has no DST (UTC+3 year-round) — safe to hard-code the offset for day-boundary math. */
const KAMPALA_OFFSET = "+03:00";

function kampalaDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Midnight of a Kampala calendar date ("YYYY-MM-DD"), expressed as the equivalent UTC instant. */
function kampalaMidnight(dateStr: string) {
  return new Date(`${dateStr}T00:00:00${KAMPALA_OFFSET}`);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Resolves a time-filter preset to a [from, to) UTC instant range, anchored to Kampala's calendar day. */
export function resolveDateRange(preset: TimePreset, customFrom?: string, customTo?: string): { gte: Date; lt: Date } | null {
  const now = new Date();
  const todayStr = kampalaDateString(now);
  const todayStart = kampalaMidnight(todayStr);

  if (preset === "today") return { gte: todayStart, lt: addDays(todayStart, 1) };

  if (preset === "week") {
    const dow = new Date(`${todayStr}T12:00:00Z`).getUTCDay(); // 0=Sun..6=Sat, using noon to avoid DST/rounding edge cases
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const weekStart = addDays(todayStart, mondayOffset);
    return { gte: weekStart, lt: addDays(weekStart, 7) };
  }

  if (preset === "month") {
    const [y, m] = todayStr.split("-").map(Number);
    const start = kampalaMidnight(`${y}-${String(m).padStart(2, "0")}-01`);
    const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
    const end = kampalaMidnight(`${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01`);
    return { gte: start, lt: end };
  }

  if (preset === "quarter") {
    const [y, m] = todayStr.split("-").map(Number);
    const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
    const start = kampalaMidnight(`${y}-${String(qStartMonth).padStart(2, "0")}-01`);
    const nextQMonth = qStartMonth + 3;
    const end = nextQMonth > 12 ? kampalaMidnight(`${y + 1}-01-01`) : kampalaMidnight(`${y}-${String(nextQMonth).padStart(2, "0")}-01`);
    return { gte: start, lt: end };
  }

  if (preset === "year") {
    const [y] = todayStr.split("-").map(Number);
    return { gte: kampalaMidnight(`${y}-01-01`), lt: kampalaMidnight(`${y + 1}-01-01`) };
  }

  if (preset === "custom" && customFrom) {
    const start = kampalaMidnight(customFrom);
    const end = customTo ? addDays(kampalaMidnight(customTo), 1) : addDays(start, 1);
    return { gte: start, lt: end };
  }

  return null;
}
