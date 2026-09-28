"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessMatter } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { personalEntrySchema, recordOutcomeSchema, scheduleEntrySchema } from "@/lib/validation/calendar";

type ActionResult = { error?: string } | void;

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

/** Lazily issues the long-lived token an external calendar app needs to subscribe (spec §5.8 .ics). */
export async function getOrCreateIcsToken(): Promise<string> {
  const user = await requireUser();
  const existing = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { icsToken: true } });
  if (existing.icsToken) return existing.icsToken;
  const token = crypto.randomBytes(24).toString("base64url");
  await db.user.update({ where: { id: user.id }, data: { icsToken: token } });
  return token;
}

export async function addPersonalEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = personalEntrySchema.safeParse({
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const entry = await db.calendarEntry.create({
    data: {
      userId: user.id,
      kind: "PERSONAL",
      title: parsed.data.title,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
  });
  await writeAudit({ userId: user.id, action: "calendar.personal.add", entity: "CalendarEntry", entityId: entry.id });
  revalidatePath("/calendar");
}

/** "Schedule hearing" / "Add deadline" from a case's ⋯ menu (FLOWS §4 header, spec §5.7). */
export async function scheduleEntry(raw: unknown): Promise<ActionResult> {
  const parsed = scheduleEntrySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, kind, title, startsAt, forumId, courtroom, purpose, isCritical, assigneeId } = parsed.data;
  const user = await requireUser();
  const allowed = await canAccessMatter(user.id, user.role, matterId);
  if (!allowed) return { error: "You don't have access to this case." };

  const entry = await db.calendarEntry.create({
    data: {
      matterId,
      kind,
      title,
      startsAt: new Date(startsAt),
      forumId: forumId || null,
      courtroom: courtroom || null,
      purpose: purpose || null,
      isCritical,
      assigneeId: assigneeId || null,
    },
  });
  await db.matter.update({ where: { id: matterId }, data: { lastActivityAt: new Date() } });
  await writeAudit({ userId: user.id, action: kind === "DEADLINE" ? "calendar.deadline.add" : "calendar.hearing.add", entity: "CalendarEntry", entityId: entry.id, after: { title } });
  revalidatePath(`/cases/${matterId}`);
  revalidatePath("/calendar");
}

export async function deletePersonalEntry(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const entry = await db.calendarEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== user.id) return { error: "You can only remove your own personal entries." };
  await db.calendarEntry.delete({ where: { id } });
  await writeAudit({ userId: user.id, action: "calendar.personal.remove", entity: "CalendarEntry", entityId: id });
  revalidatePath("/calendar");
}

/** Records what happened at a hearing/mention/mediation (FLOWS §7) — the richest action in
 * this phase: adjournment creates the next entry, a ruling suggests a matching deadline via
 * DeadlineRule, directions become tasks. */
export async function recordOutcome(raw: unknown): Promise<ActionResult> {
  const parsed = recordOutcomeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { entryId, outcomeType, outcomeNote, adjournmentReason, nextDate, directions } = parsed.data;
  const user = await requireUser();

  const entry = await db.calendarEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "That calendar entry no longer exists." };
  if (entry.matterId) {
    const allowed = await canAccessMatter(user.id, user.role, entry.matterId);
    if (!allowed) return { error: "You don't have access to this case." };
  }
  if (entry.status !== "OPEN") return { error: "This entry's outcome was already recorded." };
  if (outcomeType === "ADJOURNED" && !nextDate) return { error: "Adjournment needs a next date." };

  const lead = entry.matterId ? await db.matterAssignment.findFirst({ where: { matterId: entry.matterId, role: "LEAD", removedAt: null } }) : null;
  const fallbackAssigneeId = entry.assigneeId ?? lead?.userId ?? user.id;

  await db.$transaction(async (tx) => {
    await tx.calendarEntry.update({
      where: { id: entryId },
      data: {
        status: "DONE",
        outcomeType,
        outcomeNote: outcomeNote || null,
        adjournmentReason: outcomeType === "ADJOURNED" ? adjournmentReason || null : null,
        outcomeRecordedAt: new Date(),
        outcomeRecordedById: user.id,
      },
    });

    if ((outcomeType === "ADJOURNED" || outcomeType === "PROCEEDED") && nextDate) {
      const next = await tx.calendarEntry.create({
        data: {
          matterId: entry.matterId,
          kind: entry.kind,
          title: entry.title,
          startsAt: new Date(nextDate),
          forumId: entry.forumId,
          courtroom: entry.courtroom,
          purpose: outcomeType === "ADJOURNED" ? `Adjourned: ${adjournmentReason || entry.purpose || ""}`.trim() : entry.purpose,
          assigneeId: entry.assigneeId,
          isCritical: entry.isCritical,
        },
      });
      await tx.calendarEntry.update({ where: { id: entryId }, data: { nextEntryId: next.id } });
    }

    if (outcomeType === "RULING" && entry.matterId) {
      const rulingType = await tx.eventType.findFirst({ where: { name: "Ruling" } });
      if (rulingType) {
        const event = await tx.event.create({
          data: {
            matterId: entry.matterId,
            typeId: rulingType.id,
            title: `Ruling: ${entry.title}`,
            description: outcomeNote || null,
            date: entry.startsAt,
            createdById: user.id,
          },
        });
        const rule = await tx.deadlineRule.findFirst({ where: { triggerEventTypeId: rulingType.id, isActive: true } });
        if (rule) {
          const dueAt = new Date(entry.startsAt.getTime() + rule.offsetDays * 86_400_000);
          await tx.task.create({
            data: { matterId: entry.matterId, title: rule.title, assigneeId: fallbackAssigneeId, dueAt, createdById: user.id, sourceEntryId: entry.id },
          });
        }
        void event;
      }
    }

    if (outcomeType === "DIRECTIONS" && entry.matterId && directions) {
      const lines = directions
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const dueAt = nextDate ? new Date(nextDate) : new Date(entry.startsAt.getTime() + 7 * 86_400_000);
      for (const line of lines) {
        await tx.task.create({ data: { matterId: entry.matterId!, title: line, assigneeId: fallbackAssigneeId, dueAt, createdById: user.id, sourceEntryId: entry.id } });
      }
    }

    if (entry.matterId) await tx.matter.update({ where: { id: entry.matterId }, data: { lastActivityAt: new Date() } });
    await writeAudit({ userId: user.id, action: "calendar.outcome.record", entity: "CalendarEntry", entityId: entryId, after: { outcomeType } }, tx);
  });

  revalidatePath("/calendar");
  if (entry.matterId) revalidatePath(`/cases/${entry.matterId}`);
}
