import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { CalendarClient, type CalendarEvent } from "./calendar-client";

export const metadata = { title: "Calendar" };

const KIND_COLOR: Record<string, string> = {
  HEARING: "var(--primary)",
  MENTION: "var(--primary)",
  MEDIATION: "var(--primary)",
  JUDGMENT: "var(--primary)",
  DEADLINE: "var(--warning)",
  PERSONAL: "var(--text-muted)",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireRole();
  const isAdmin = me.role === "ADMIN";
  const sp = await searchParams;
  const lawyerFilter = isAdmin && typeof sp.lawyer === "string" ? sp.lawyer : undefined;

  const entryWhere = isAdmin
    ? lawyerFilter
      ? { OR: [{ assigneeId: lawyerFilter }, { userId: lawyerFilter }] }
      : {}
    : { OR: [{ assigneeId: me.id }, { userId: me.id }] };
  const taskWhere = isAdmin ? (lawyerFilter ? { assigneeId: lawyerFilter } : {}) : { assigneeId: me.id };

  // A Server Component render is already tied to one request — "now" is legitimately
  // request-time here, not a hook needing to be stable across client re-renders.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const [entries, tasks, lawyers] = await Promise.all([
    db.calendarEntry.findMany({
      where: entryWhere,
      include: { matter: { select: { id: true, reference: true, title: true } }, assignee: { select: { id: true, name: true } }, user: { select: { id: true, name: true } } },
    }),
    db.task.findMany({ where: taskWhere, include: { matter: { select: { id: true, reference: true, title: true } }, assignee: { select: { id: true, name: true } } } }),
    isAdmin ? db.user.findMany({ where: { role: "LAWYER", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const events: CalendarEvent[] = [
    ...entries.map((e) => ({
      id: e.id,
      type: "entry" as const,
      title: e.matter ? `${e.matter.reference} — ${e.title}` : e.title,
      start: e.startsAt.toISOString(),
      end: e.endsAt ? e.endsAt.toISOString() : undefined,
      color: KIND_COLOR[e.kind],
      matterId: e.matter?.id ?? null,
      kind: e.kind,
      status: e.status,
      assigneeName: e.assignee?.name ?? e.user?.name ?? null,
      courtroom: e.courtroom,
      purpose: e.purpose,
      isCritical: e.isCritical,
      outcomeType: e.outcomeType,
      outcomeNote: e.outcomeNote,
      isPast: e.startsAt.getTime() < now,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.matter ? `${t.matter.reference} — ${t.title}` : t.title,
      start: t.dueAt.toISOString(),
      end: undefined,
      color: "var(--text-muted)",
      matterId: t.matter?.id ?? null,
      kind: "TASK" as const,
      status: t.status,
      assigneeName: t.assignee.name,
      courtroom: null,
      purpose: null,
      isCritical: false,
      outcomeType: null,
      outcomeNote: null,
      isPast: t.dueAt.getTime() < now,
    })),
  ];

  // Clash detection (spec §5.8): two open hearings for the same assignee overlapping in time.
  const clashes: string[] = [];
  const hearings = entries.filter((e) => e.kind === "HEARING" && e.status === "OPEN" && e.assigneeId);
  for (const assigneeId of new Set(hearings.map((h) => h.assigneeId))) {
    const mine = hearings.filter((h) => h.assigneeId === assigneeId);
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        const a = mine[i];
        const b = mine[j];
        const aEnd = a.endsAt ?? new Date(a.startsAt.getTime() + 3_600_000);
        const bEnd = b.endsAt ?? new Date(b.startsAt.getTime() + 3_600_000);
        if (a.startsAt < bEnd && b.startsAt < aEnd) {
          clashes.push(`${a.assignee?.name ?? "Someone"} is double-booked: "${a.title}" and "${b.title}" overlap.`);
        }
      }
    }
  }

  return (
    <>
      <PageHeader title={isAdmin ? "Department calendar" : "My calendar"} description={isAdmin ? "Every lawyer's hearings, deadlines and tasks." : "Hearings, deadlines and tasks from your cases."} />
      <CalendarClient events={events} clashes={clashes} isAdmin={isAdmin} lawyers={lawyers} currentLawyerId={lawyerFilter} />
    </>
  );
}
