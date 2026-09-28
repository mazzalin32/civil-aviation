import { z } from "zod";

/** Category and MatterType chips use only these design tokens (spec §10) — never a free hex. */
export const CHIP_COLORS = ["neutral", "primary", "success", "warning", "danger"] as const;

const name = z.string().trim().min(1, "Enter a name").max(80);

export const categorySchema = z.object({
  id: z.string().optional(),
  name,
  color: z.enum(CHIP_COLORS),
});

export const matterTypeSchema = z.object({
  id: z.string().optional(),
  name,
  referencePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, "2–6 letters, e.g. LIT")
    .optional()
    .or(z.literal("")),
  closurePolicy: z.enum(["ADMIN_APPROVAL", "LAWYER_CLOSES"]),
  isSubProcess: z.coerce.boolean().default(false),
});

export const stageTemplateSchema = z.object({
  id: z.string().optional(),
  matterTypeId: z.string().min(1),
  name,
  description: z.string().trim().max(200).optional().or(z.literal("")),
  allowsClosure: z.coerce.boolean().default(false),
  // Comma-separated field keys, e.g. "filingDate, serviceDate" — the real form fields
  // arrive in Phase 5; this just records which keys a stage move should collect.
  requiredFields: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

export const forumSchema = z.object({
  id: z.string().optional(),
  name,
  level: z.string().trim().min(1, "Choose a level").max(40),
  division: z.string().trim().max(80).optional().or(z.literal("")),
  location: z.string().trim().max(80).optional().or(z.literal("")),
});

export const eventTypeSchema = z.object({
  id: z.string().optional(),
  name,
});

export const documentFolderSchema = z.object({
  id: z.string().optional(),
  name,
});

export const outcomeSchema = z.object({
  id: z.string().optional(),
  name,
});

export const reminderRuleSchema = z.object({
  id: z.string().min(1),
  // "7,3,1,0" → [7,3,1,0]
  offsets: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number),
    )
    .refine((arr) => arr.length > 0 && arr.every((n) => Number.isInteger(n)), "Enter one or more whole numbers, comma-separated"),
  channels: z.array(z.enum(["IN_APP", "EMAIL"])).min(1, "Choose at least one channel"),
});

export const deadlineRuleSchema = z.object({
  id: z.string().optional(),
  name, // the rule's own short title, e.g. "Notice of appeal due"
  triggerEventTypeId: z.string().min(1, "Choose a trigger event type"),
  offsetDays: z.coerce.number().int(),
  isCritical: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
