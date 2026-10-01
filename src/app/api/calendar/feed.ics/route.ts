import { NextResponse, type NextRequest } from "next/server";
import { createEvents, type EventAttributes } from "ics";
import { db } from "@/lib/db";

function toDateArray(d: Date): [number, number, number, number, number] {
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
}

/**
 * .ics subscription feed (spec §5.8): a phone/Outlook calendar shows only the case reference
 * and time by default — never confidential details. Token-authenticated since calendar apps
 * poll this URL directly, without a browser session.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return new NextResponse("Missing token", { status: 401 });

  const user = await db.user.findUnique({ where: { icsToken: token }, select: { id: true, role: true } });
  if (!user) return new NextResponse("Invalid token", { status: 401 });

  const notDeleted = { NOT: { matter: { deletedAt: { not: null } } } };
  const where = user.role === "ADMIN" ? notDeleted : { ...notDeleted, OR: [{ assigneeId: user.id }, { userId: user.id }] };
  const [entries, tasks] = await Promise.all([
    db.calendarEntry.findMany({ where, include: { matter: { select: { reference: true } } } }),
    db.task.findMany({ where: user.role === "ADMIN" ? notDeleted : { ...notDeleted, assigneeId: user.id }, include: { matter: { select: { reference: true } } } }),
  ]);

  const events: EventAttributes[] = [
    ...entries.map((e): EventAttributes =>
      e.endsAt
        ? { uid: `entry-${e.id}@caa-legal`, title: e.matter ? `${e.matter.reference} — ${e.kind}` : e.title, start: toDateArray(e.startsAt), end: toDateArray(e.endsAt) }
        : { uid: `entry-${e.id}@caa-legal`, title: e.matter ? `${e.matter.reference} — ${e.kind}` : e.title, start: toDateArray(e.startsAt), duration: { hours: 1 } },
    ),
    ...tasks.map(
      (t): EventAttributes => ({
        uid: `task-${t.id}@caa-legal`,
        title: t.matter ? `${t.matter.reference} — Task due` : "Task due",
        start: toDateArray(t.dueAt),
        duration: { minutes: 30 },
      }),
    ),
  ];

  const { error, value } = createEvents(events);
  if (error || !value) return new NextResponse("Could not generate calendar", { status: 500 });

  return new NextResponse(value, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="caa-legal.ics"' },
  });
}
