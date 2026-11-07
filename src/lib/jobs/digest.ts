import "server-only";
import { getTotalUnread } from "../chat/unread";
import { db } from "../db";
import { sendDigestEmail, type DigestSection } from "../mailer";
import { formatDate } from "../time";
import { ACTIVE_USER, COURT_KINDS, DIGEST_LAST_HOUR, KIND_LABEL, LIVE_MATTER, REMINDER_START_HOUR, claim, release, roughEnd, roughStart } from "./common";
import { daysBetween, kampalaDay, kampalaHour, type Day } from "./due";

const time = (d: Date) => formatDate(d, { hour: "2-digit", minute: "2-digit" });

/**
 * The optional 7:00 AM "Your day" email (spec §5.9, FLOWS §5) for everyone with the digest switched
 * on: today's sittings, deadlines and tasks due today or overdue, and unread chat. Once per person per
 * Kampala day; nothing is sent when there is nothing to report.
 */
export async function sendDigests(now: Date, today: Day): Promise<number> {
  const hour = kampalaHour(now);
  if (hour < REMINDER_START_HOUR || hour >= DIGEST_LAST_HOUR) return 0;

  const users = await db.user.findMany({
    where: { ...ACTIVE_USER, digestEnabled: true, role: { in: ["ADMIN", "LAWYER"] }, organizationId: { not: null } },
    select: { id: true, name: true, email: true, role: true, organizationId: true },
  });
  if (users.length === 0) return 0;
  const already = new Set((await db.reminderLog.findMany({ where: { key: { in: users.map((u) => `DIGEST:${u.id}:${today}`) } }, select: { key: true } })).map((r) => r.key));

  let sent = 0;
  for (const u of users) {
    const key = `DIGEST:${u.id}:${today}`;
    if (already.has(key) || !(await claim(key))) continue;
    try {
      const { sections, unread } = await digestFor(u, today);
      if (sections.every((s) => s.items.length === 0) && unread === 0) continue; // claimed: not re-checked all morning
      await sendDigestEmail(
        u.email,
        u.name,
        formatDate(now, { weekday: "long", day: "numeric", month: "long" }),
        sections,
        unread ? `You have ${unread} unread chat ${unread === 1 ? "message" : "messages"}.` : undefined,
      );
      sent++;
    } catch (err) {
      await release(key);
      console.error(`jobs: digest for ${u.id} failed, will retry`, err);
    }
  }
  return sent;
}

async function digestFor(u: { id: string; role: string; organizationId: string | null }, today: Day) {
  // "Mine" = assigned to me directly, or on a matter I'm on.
  const mine = { OR: [{ assigneeId: u.id }, { matter: { assignments: { some: { userId: u.id, removedAt: null } } } }] };
  const [sittings, deadlines, tasks, unread] = await Promise.all([
    db.calendarEntry.findMany({
      where: { ...mine, kind: { in: [...COURT_KINDS] }, status: "OPEN", matter: LIVE_MATTER, startsAt: { gte: roughStart(today), lt: roughEnd(today) } },
      select: { kind: true, title: true, startsAt: true, courtroom: true, forum: { select: { name: true } }, matter: { select: { id: true, reference: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.calendarEntry.findMany({
      where: { ...mine, kind: "DEADLINE", status: "OPEN", matter: LIVE_MATTER, startsAt: { lt: roughEnd(today) } },
      select: { title: true, startsAt: true, isCritical: true, matter: { select: { id: true, reference: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.task.findMany({
      where: { assigneeId: u.id, status: "OPEN", doneAt: null, matter: LIVE_MATTER, dueAt: { lt: roughEnd(today) } },
      select: { title: true, dueAt: true, matter: { select: { id: true, reference: true } } },
      orderBy: { dueAt: "asc" },
    }),
    getTotalUnread(u),
  ]);

  const dueBy = (d: Date) => daysBetween(today, kampalaDay(d));
  const dueLabel = (d: Date) => (dueBy(d) === 0 ? "Due today" : `Overdue since ${formatDate(d)}`);

  const sections: DigestSection[] = [
    {
      title: "Today in court",
      items: sittings
        .filter((s) => kampalaDay(s.startsAt) === today)
        .map((s) => ({
          text: `${time(s.startsAt)} · ${KIND_LABEL[s.kind] ?? "Hearing"}: ${s.title}`,
          meta: [s.matter?.reference, s.forum?.name, s.courtroom].filter(Boolean).join(" · "),
          url: s.matter ? `/cases/${s.matter.id}?tab=hearings` : undefined,
        })),
    },
    {
      title: "Deadlines",
      items: deadlines
        .filter((d) => dueBy(d.startsAt) <= 0)
        .map((d) => ({
          text: `${d.isCritical ? "Critical: " : ""}${d.title}`,
          meta: [dueLabel(d.startsAt), d.matter?.reference].filter(Boolean).join(" · "),
          url: d.matter ? `/cases/${d.matter.id}?tab=hearings` : undefined,
        })),
    },
    {
      title: "Tasks",
      items: tasks
        .filter((t) => dueBy(t.dueAt) <= 0)
        .map((t) => ({ text: t.title, meta: `${dueLabel(t.dueAt)} · ${t.matter.reference}`, url: `/cases/${t.matter.id}?tab=tasks` })),
    },
  ];
  return { sections, unread };
}
