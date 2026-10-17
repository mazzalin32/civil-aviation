import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const moveStageSchema = z.object({
  matterId: z.string().min(1),
  stageTemplateId: z.string().min(1, "Choose a stage"),
  note: optionalText(500),
  fields: z.record(z.string(), z.string()).optional(),
});

export const addEventSchema = z.object({
  matterId: z.string().min(1),
  typeId: z.string().min(1, "Choose an event type"),
  title: z.string().trim().min(1, "Enter a short title").max(200),
  description: optionalText(2000),
  date: z.string().min(1, "Choose a date"),
});

export const updateSummarySchema = z.object({
  matterId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first").max(4000),
});

export const noteSchema = z.object({
  matterId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first").max(4000),
  isPrivate: z.coerce.boolean().default(false),
});

export const updateNoteSchema = noteSchema.extend({ id: z.string().min(1) });

export const partyFormSchema = z.object({
  matterId: z.string().min(1),
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter a name"),
  kind: z.enum(["OPPOSING", "WITNESS", "INTERNAL", "OTHER"]),
  counselName: optionalText(120),
  counselFirm: optionalText(120),
  email: optionalText(120),
  phone: optionalText(40),
  address: optionalText(200),
  department: optionalText(80),
});

export const reassignSchema = z.object({
  matterId: z.string().min(1),
  leadUserId: z.string().min(1, "Choose a lead lawyer"),
  supportUserIds: z.array(z.string()).default([]),
  reason: optionalText(300),
});

export const holdSchema = z.object({
  matterId: z.string().min(1),
  reason: optionalText(300),
});

export const updateSourceUrlSchema = z.object({
  matterId: z.string().min(1),
  sourceUrl: z.string().trim().url("Enter a valid URL").max(500).optional().or(z.literal("")),
});
