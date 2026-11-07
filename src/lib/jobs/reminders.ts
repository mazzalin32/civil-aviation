import "server-only";
import { db } from "../db";
import { notify, type NotifyInput } from "../notify";
import { formatDate } from "../time";
import { addDays, dayCount, daysBetween, dueStageAfter, dueStageBefore, kampalaDay, relativeDay, type Day } from "./due";
import {
  ACTIVE_USER,
  COURT_KINDS,
  KIND_LABEL,
  LIVE_MATTER,
  MATTER_WITH_TEAM,
  alreadySent,
  claim,
  leadIds,
  loadRule,
  orgAdminIds,
  release,
  roughEnd,
  roughStart,
  sendOnce,
  teamIds,
  unique,
  type MatterWithTeam,
} from "./common";

/**
 * The time-based reminders of spec §5.9. Each one reads its schedule from its NotificationRule (Admin
 * Settings → Reminders), works in Kampala calendar days, and sends each stage to each person once
 * (ReminderLog). Keys carry the date itself, so moving a hearing re-arms its reminders for the new date.
 */

export type Ctx = { now: Date; today: Day; startDay: Day; admins: Map<string, string[]> };

type Candidate = { key: string; send: () => Promise<boolean> };

/** Sends the candidates not already in the log; returns how many went out. */
async function deliver(candidates: Candidate[]): Promise<number> {
  const sent = await alreadySent(candidates.map((c) => c.key));
  let n = 0;
  for (const c of candidates) if (!sent.has(c.key) && (await c.send())) n++;
  return n;
}

const caseTab = (matterId: string, tab: string) => `/cases/${matterId}?tab=${tab}`;
const when = (d: Date) => formatDate(d, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------- hearings (7 days, 1 day, morning of)

export async function hearingReminders(ctx: Ctx): Promise<number> {
  const rule = await loadRule("HEARING_REMINDER");
  if (!rule) return 0;
  const entries = await db.calendarEntry.findMany({
    where: {
      kind: { in: [...COURT_KINDS] },
      status: "OPEN",
      matter: LIVE_MATTER,
      startsAt: { gte: roughStart(ctx.today), lte: roughEnd(addDays(ctx.today, Math.max(0, ...rule.offsets))) },
    },
    select: {
      id: true,
      kind: true,
      title: true,
      startsAt: true,
      assigneeId: true,
      assignee: { select: { isActive: true, deletedAt: true } },
      forum: { select: { name: true } },
      matter: MATTER_WITH_TEAM,
    },
  });

  const candidates: Candidate[] = [];
  for (const e of entries) {
    if (!e.matter) continue;
    const day = kampalaDay(e.startsAt);
    const daysUntil = daysBetween(ctx.today, day);
    const stage = dueStageBefore(rule.offsets, daysUntil);
    if (stage === undefined || daysUntil < 0 || day < ctx.startDay) continue;

    const matter = e.matter as MatterWithTeam;
    const assignee = e.assigneeId && e.assignee?.isActive && !e.assignee.deletedAt ? [e.assigneeId] : [];
    const label = KIND_LABEL[e.kind] ?? "Hearing";
    for (const userId of unique([...assignee, ...teamIds(matter)])) {
      const key = `HEARING_REMINDER:${e.id}:${day}:${stage}:${userId}`;
      candidates.push({
        key,
        send: () =>
          sendOnce(key, {
            userId,
            type: "HEARING_REMINDER",
            matterId: matter.id,
            subject: `${label} ${relativeDay(daysUntil)}: ${matter.reference}`,
            message: `${label} ${relativeDay(daysUntil)} in ${matter.title} — ${when(e.startsAt)}${e.forum ? `, ${e.forum.name}` : ""}.`,
            url: caseTab(matter.id, "hearings"),
            payload: { entryId: e.id, stage, day },
          }),
      });
    }
  }
  return deliver(candidates);
}

// ---------------------------------------------------------------- deadlines and tasks (7/3/1 days + overdue)

function deadlineWording(daysUntil: number) {
  return daysUntil < 0 ? `overdue by ${dayCount(-daysUntil)}` : `due ${relativeDay(daysUntil)}`;
}

export async function deadlineReminders(ctx: Ctx): Promise<number> {
  const rule = await loadRule("DEADLINE_REMINDER");
  if (!rule) return 0;
  // Overdue stages look back, but never past the day reminders were switched on (see remindersStartDay).
  const from = roughStart(ctx.startDay);
  const to = roughEnd(addDays(ctx.today, Math.max(0, ...rule.offsets)));

  const [entries, tasks] = await Promise.all([
    db.calendarEntry.findMany({
      where: { kind: "DEADLINE", status: "OPEN", matter: LIVE_MATTER, startsAt: { gte: from, lte: to } },
      select: { id: true, title: true, startsAt: true, isCritical: true, assigneeId: true, assignee: { select: { isActive: true, deletedAt: true } }, matter: MATTER_WITH_TEAM },
    }),
    db.task.findMany({
      where: { status: "OPEN", doneAt: null, matter: LIVE_MATTER, assignee: ACTIVE_USER, dueAt: { gte: from, lte: to } },
      select: { id: true, title: true, dueAt: true, assigneeId: true, matter: { select: { id: true, title: true, reference: true } } },
    }),
  ]);

  const candidates: Candidate[] = [];
  const stageFor = (date: Date) => {
    const day = kampalaDay(date);
    const daysUntil = daysBetween(ctx.today, day);
    const stage = dueStageBefore(rule.offsets, daysUntil);
    // A positive/zero stage is a "coming up" reminder — meaningless once the day has passed.
    const ok = stage !== undefined && day >= ctx.startDay && !(daysUntil < 0 && stage >= 0);
    return ok ? { day, daysUntil, stage: stage! } : null;
  };

  for (const e of entries) {
    const s = stageFor(e.startsAt);
    if (!s || !e.matter) continue;
    const matter = e.matter as MatterWithTeam;
    const overdue = s.daysUntil < 0;
    const assignee = e.assigneeId && e.assignee?.isActive && !e.assignee.deletedAt ? [e.assigneeId] : [];
    // Spec §5.9: assigned lawyers, plus the Admin once it is overdue.
    const admins = overdue ? await orgAdminIds(matter.organizationId, ctx.admins) : [];
    for (const userId of unique([...assignee, ...teamIds(matter), ...admins])) {
      const key = `DEADLINE_REMINDER:entry:${e.id}:${s.day}:${s.stage}:${userId}`;
      candidates.push({
        key,
        send: () =>
          sendOnce(key, {
            userId,
            type: "DEADLINE_REMINDER",
            matterId: matter.id,
            subject: `${overdue ? "Overdue" : "Deadline"}: ${e.title} (${matter.reference})`,
            message: `${e.isCritical ? "Critical deadline" : "Deadline"} "${e.title}" in ${matter.title} is ${deadlineWording(s.daysUntil)} (${formatDate(e.startsAt)}).`,
            url: caseTab(matter.id, "hearings"),
            payload: { entryId: e.id, stage: s.stage, day: s.day },
          }),
      });
    }
  }

  for (const t of tasks) {
    const s = stageFor(t.dueAt);
    if (!s) continue;
    const key = `DEADLINE_REMINDER:task:${t.id}:${s.day}:${s.stage}:${t.assigneeId}`;
    candidates.push({
      key,
      send: () =>
        sendOnce(key, {
          userId: t.assigneeId,
          type: "DEADLINE_REMINDER",
          matterId: t.matter.id,
          subject: `Task ${deadlineWording(s.daysUntil)}: ${t.title}`,
          message: `Your task "${t.title}" in ${t.matter.title} is ${deadlineWording(s.daysUntil)} (${formatDate(t.dueAt)}).`,
          url: caseTab(t.matter.id, "tasks"),
          payload: { taskId: t.id, stage: s.stage, day: s.day },
        }),
    });
  }
  return deliver(candidates);
}

// ---------------------------------------------------------------- hearing passed, no outcome recorded

export async function outcomeMissingReminders(ctx: Ctx): Promise<number> {
  const rule = await loadRule("HEARING_OUTCOME_MISSING");
  if (!rule) return 0;
  const firstStage = Math.min(...rule.offsets.map(Math.abs));
  const entries = await db.calendarEntry.findMany({
    where: {
      kind: { in: [...COURT_KINDS] },
      status: "OPEN",
      outcomeRecordedAt: null,
      nextEntryId: null,
      matter: LIVE_MATTER,
      startsAt: { gte: roughStart(ctx.startDay), lt: roughEnd(ctx.today) },
    },
    select: { id: true, kind: true, title: true, startsAt: true, matter: MATTER_WITH_TEAM },
  });

  const candidates: Candidate[] = [];
  for (const e of entries) {
    if (!e.matter) continue;
    const day = kampalaDay(e.startsAt);
    const daysSince = daysBetween(day, ctx.today);
    const stage = dueStageAfter(rule.offsets, daysSince);
    if (stage === undefined || daysSince < 1 || day < ctx.startDay) continue;

    const matter = e.matter as MatterWithTeam;
    // Spec §5.9: the lead lawyer first; from the next stage on, the Admin as well.
    const escalated = stage > firstStage;
    const admins = escalated ? await orgAdminIds(matter.organizationId, ctx.admins) : [];
    const label = (KIND_LABEL[e.kind] ?? "Hearing").toLowerCase();
    for (const userId of unique([...leadIds(matter), ...admins])) {
      const key = `HEARING_OUTCOME_MISSING:${e.id}:${day}:${stage}:${userId}`;
      candidates.push({
        key,
        send: () =>
          sendOnce(key, {
            userId,
            type: "HEARING_OUTCOME_MISSING",
            matterId: matter.id,
            subject: `Outcome not recorded: ${matter.reference}`,
            message: `No outcome has been recorded for the ${label} on ${formatDate(e.startsAt)} in ${matter.title} (${dayCount(daysSince)} ago).`,
            url: caseTab(matter.id, "hearings"),
            payload: { entryId: e.id, stage, day, escalated },
          }),
      });
    }
  }
  return deliver(candidates);
}

// ---------------------------------------------------------------- practising certificate expiring

export async function certificateReminders(ctx: Ctx): Promise<number> {
  const rule = await loadRule("CERT_EXPIRING");
  if (!rule) return 0;
  const users = await db.user.findMany({
    where: {
      ...ACTIVE_USER,
      role: { in: ["ADMIN", "LAWYER"] },
      certExpiry: { gte: roughStart(ctx.startDay), lte: roughEnd(addDays(ctx.today, Math.max(0, ...rule.offsets))) },
    },
    select: { id: true, name: true, organizationId: true, certExpiry: true, practisingCertNo: true },
  });

  const candidates: Candidate[] = [];
  for (const u of users) {
    if (!u.certExpiry) continue;
    const day = kampalaDay(u.certExpiry);
    const daysUntil = daysBetween(ctx.today, day);
    const stage = dueStageBefore(rule.offsets, daysUntil);
    if (stage === undefined || day < ctx.startDay || (daysUntil < 0 && stage >= 0)) continue;

    const expires = daysUntil < 0 ? `expired ${relativeDay(daysUntil)}` : `expires ${relativeDay(daysUntil)}`;
    const admins = await orgAdminIds(u.organizationId, ctx.admins);
    for (const userId of unique([u.id, ...admins])) {
      const self = userId === u.id;
      const key = `CERT_EXPIRING:${u.id}:${day}:${stage}:${userId}`;
      candidates.push({
        key,
        send: () =>
          sendOnce(key, {
            userId,
            type: "CERT_EXPIRING",
            subject: self ? "Your practising certificate is expiring" : `Practising certificate expiring: ${u.name}`,
            message: `${self ? "Your" : `${u.name}'s`} practising certificate${u.practisingCertNo ? ` (${u.practisingCertNo})` : ""} ${expires} — ${formatDate(u.certExpiry!)}.`,
            url: self ? undefined : `/users/${u.id}`,
            payload: { subjectUserId: u.id, stage, day },
          }),
      });
    }
  }
  return deliver(candidates);
}

// ---------------------------------------------------------------- case inactive N days

/**
 * One notice per person per run, not one per case: imported or long-running matters can cross the
 * threshold together, and twenty identical alerts help nobody. Each case is still only counted once.
 */
export async function inactiveCaseReminders(ctx: Ctx): Promise<number> {
  const rule = await loadRule("CASE_INACTIVE");
  if (!rule) return 0;
  const threshold = Math.min(...rule.offsets.map(Math.abs));
  const matters = await db.matter.findMany({
    where: { deletedAt: null, status: { in: ["OPEN", "ON_HOLD"] }, lastActivityAt: { lt: roughEnd(addDays(ctx.today, -threshold)) } },
    select: { ...MATTER_WITH_TEAM.select, lastActivityAt: true },
  });

  // recipient → the cases newly due for them (key + matter)
  const due = new Map<string, { key: string; matter: MatterWithTeam; days: number }[]>();
  for (const m of matters) {
    const lastDay = kampalaDay(m.lastActivityAt);
    const days = daysBetween(lastDay, ctx.today);
    const stage = dueStageAfter(rule.offsets, days);
    if (stage === undefined) continue;
    const admins = await orgAdminIds(m.organizationId, ctx.admins);
    for (const userId of unique([...leadIds(m), ...admins])) {
      const list = due.get(userId) ?? [];
      list.push({ key: `CASE_INACTIVE:${m.id}:${lastDay}:${stage}:${userId}`, matter: m, days });
      due.set(userId, list);
    }
  }

  const sentKeys = await alreadySent([...due.values()].flat().map((d) => d.key));
  let n = 0;
  for (const [userId, all] of due) {
    const fresh = all.filter((d) => !sentKeys.has(d.key));
    if (fresh.length === 0) continue;
    const claimed = [];
    for (const d of fresh) if (await claim(d.key)) claimed.push(d);
    if (claimed.length === 0) continue;

    const one = claimed.length === 1 ? claimed[0] : null;
    const ok = await notifyOrRelease(
      claimed.map((d) => d.key),
      {
        userId,
        type: "CASE_INACTIVE",
        matterId: one?.matter.id ?? null,
        subject: one ? `No activity for ${dayCount(one.days)}: ${one.matter.reference}` : `${claimed.length} cases with no recent activity`,
        message: one
          ? `${one.matter.title} (${one.matter.reference}) has had no activity for ${dayCount(one.days)}.`
          : `${claimed.length} cases have had no activity for ${dayCount(threshold)} or more: ${claimed
              .slice(0, 3)
              .map((d) => d.matter.reference)
              .join(", ")}${claimed.length > 3 ? ` and ${claimed.length - 3} more` : ""}.`,
        url: one ? `/cases/${one.matter.id}` : "/cases?sort=lastActivityAt&dir=asc",
        payload: { matterIds: claimed.map((d) => d.matter.id) },
      },
    );
    if (ok) n++;
  }
  return n;
}

/** The collapsed notice covers several claimed keys; if it fails, release them all for the next run. */
async function notifyOrRelease(keys: string[], input: NotifyInput): Promise<boolean> {
  try {
    await notify(input);
    return true;
  } catch (err) {
    for (const k of keys) await release(k);
    console.error("jobs: inactive-case notice failed, will retry", err);
    return false;
  }
}
