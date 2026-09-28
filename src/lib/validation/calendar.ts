import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const personalEntrySchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  startsAt: z.string().min(1, "Choose a date/time"),
  endsAt: optionalText(40),
});

export const recordOutcomeSchema = z.object({
  entryId: z.string().min(1),
  outcomeType: z.enum(["PROCEEDED", "ADJOURNED", "RULING", "DIRECTIONS"]),
  outcomeNote: optionalText(2000),
  adjournmentReason: optionalText(500),
  nextDate: optionalText(40),
  directions: optionalText(4000), // one instruction per line
});

export const scheduleEntrySchema = z.object({
  matterId: z.string().min(1),
  kind: z.enum(["HEARING", "MENTION", "MEDIATION", "JUDGMENT", "DEADLINE"]),
  title: z.string().trim().min(1, "Enter a title").max(200),
  startsAt: z.string().min(1, "Choose a date/time"),
  forumId: optionalText(40),
  courtroom: optionalText(80),
  purpose: optionalText(300),
  isCritical: z.coerce.boolean().default(false),
  assigneeId: optionalText(40),
});

export const taskSchema = z.object({
  matterId: z.string().min(1),
  title: z.string().trim().min(1, "Enter a title").max(200),
  assigneeId: z.string().min(1, "Choose an assignee"),
  dueAt: z.string().min(1, "Choose a due date"),
});

export const naSchema = z.object({
  reason: z.string().trim().min(1, "Say why this isn't applicable").max(300),
});
