import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { notify, type NotifyInput } from "../notify";
import { addDays, kampalaDay, type Day } from "./due";

/**
 * Operating hours of the job runner — times of day, not legal periods (those are all Admin data in
 * NotificationRule). Day-based reminders wait for the working morning instead of arriving at
 * midnight; the digest is only worth sending in the morning, so a server that was down at 7:00
 * catches up until noon and then skips that day rather than sending "Your day" in the evening.
 */
export const REMINDER_START_HOUR = 7;
export const DIGEST_LAST_HOUR = 12;

/** Calendar kinds that are a sitting before a forum (they get hearing reminders and need an outcome). */
export const COURT_KINDS = ["HEARING", "MENTION", "MEDIATION", "JUDGMENT"] as const;
export const KIND_LABEL: Record<string, string> = {
  HEARING: "Hearing",
  MENTION: "Mention",
  MEDIATION: "Mediation session",
  JUDGMENT: "Judgment",
  DEADLINE: "Deadline",
};

/** People who can still receive anything. */
export const ACTIVE_USER = { isActive: true, deletedAt: null } satisfies Prisma.UserWhereInput;
/** Matters still being worked on — closed or deleted ones get no reminders. */
export const LIVE_MATTER = { deletedAt: null, status: { not: "CLOSED" } } satisfies Prisma.MatterWhereInput;

export type ScheduleRule = { offsets: number[] };

/** The Admin-configured schedule for a trigger, or null when it can't send anything (no offsets / no channels). */
export async function loadRule(trigger: string): Promise<ScheduleRule | null> {
  const rule = await db.notificationRule.findUnique({ where: { trigger } });
  if (!rule || rule.offsets.length === 0 || rule.channels.length === 0) return null;
  return { offsets: rule.offsets };
}

const STARTED_KEY = "jobs.remindersStartedAt";

/**
 * The day reminders were first switched on. Anything whose date fell before it (an old hearing never
 * given an outcome, a deadline long overdue in imported data) is history, not news, and is skipped —
 * otherwise go-live would bury everyone in years of "overdue" alerts. Stored once, never moved.
 */
export async function remindersStartDay(now: Date): Promise<Day> {
  const existing = await db.setting.findUnique({ where: { key: STARTED_KEY } });
  if (existing && typeof existing.value === "string") return kampalaDay(new Date(existing.value));
  await db.setting.upsert({ where: { key: STARTED_KEY }, update: {}, create: { key: STARTED_KEY, value: now.toISOString() } });
  const stored = await db.setting.findUniqueOrThrow({ where: { key: STARTED_KEY } });
  return kampalaDay(new Date(stored.value as string));
}

/**
 * A UTC instant safely before/after a Kampala day, for coarse database filters. Callers then decide
 * precisely on `kampalaDay(...)`; the one-day margin covers the time-zone offset without hard-coding it.
 */
export function roughStart(day: Day): Date {
  return new Date(`${addDays(day, -1)}T00:00:00Z`);
}
export function roughEnd(day: Day): Date {
  return new Date(`${addDays(day, 2)}T00:00:00Z`);
}

/** Which of these reminder keys were already sent — one query instead of one per candidate. */
export async function alreadySent(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db.reminderLog.findMany({ where: { key: { in: keys } }, select: { key: true } });
  return new Set(rows.map((r) => r.key));
}

/**
 * Claims a reminder key; true only for the one caller that inserted it. The primary key makes this
 * safe across overlapping runs and several app instances.
 */
export async function claim(key: string): Promise<boolean> {
  const { count } = await db.reminderLog.createMany({ data: [{ key }], skipDuplicates: true });
  return count === 1;
}

/** Releases a claim after a failed send, so the next run tries again. */
export async function release(key: string) {
  await db.reminderLog.deleteMany({ where: { key } });
}

/** Sends one reminder at most once. Returns true when it was sent by this call. */
export async function sendOnce(key: string, input: NotifyInput): Promise<boolean> {
  if (!(await claim(key))) return false;
  try {
    await notify(input);
    return true;
  } catch (err) {
    await release(key);
    console.error(`jobs: reminder ${key} failed, will retry`, err);
    return false;
  }
}

/** Active Admins of an organisation (overdue escalations, outcome escalations, certificate alerts). */
export async function orgAdminIds(organizationId: string | null, cache: Map<string, string[]>): Promise<string[]> {
  if (!organizationId) return [];
  const hit = cache.get(organizationId);
  if (hit) return hit;
  const admins = await db.user.findMany({ where: { organizationId, role: "ADMIN", ...ACTIVE_USER }, select: { id: true } });
  const ids = admins.map((a) => a.id);
  cache.set(organizationId, ids);
  return ids;
}

/** Matter fields every reminder needs, with the current team (active people only). */
export const MATTER_WITH_TEAM = {
  select: {
    id: true,
    title: true,
    reference: true,
    organizationId: true,
    assignments: { where: { removedAt: null, user: ACTIVE_USER }, select: { userId: true, role: true } },
  },
} as const;

export type MatterWithTeam = {
  id: string;
  title: string;
  reference: string;
  organizationId: string;
  assignments: { userId: string; role: string }[];
};

export function teamIds(matter: MatterWithTeam): string[] {
  return matter.assignments.map((a) => a.userId);
}

/** The lead lawyer(s); falls back to the whole team when nobody is marked lead. */
export function leadIds(matter: MatterWithTeam): string[] {
  const leads = matter.assignments.filter((a) => a.role === "LEAD").map((a) => a.userId);
  return leads.length ? leads : teamIds(matter);
}

export const unique = <T,>(xs: T[]) => [...new Set(xs)];
