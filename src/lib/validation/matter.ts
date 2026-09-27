import { z } from "zod";

export const UCAA_ROLES = ["PLAINTIFF", "DEFENDANT", "APPLICANT", "RESPONDENT", "ADVISOR"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const CONFIDENTIALITIES = ["NORMAL", "CONFIDENTIAL", "HIGHLY_CONFIDENTIAL"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const basicsSchema = z.object({
  title: z.string().trim().min(3, "Enter a case title").max(200),
  categoryId: z.string().min(1, "Choose a category"),
  matterTypeId: z.string().min(1, "Choose a matter type"),
  ucaaRole: z.enum(UCAA_ROLES),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  confidentiality: z.enum(CONFIDENTIALITIES).default("NORMAL"),
});
export type Basics = z.infer<typeof basicsSchema>;

export const forumStepSchema = z.object({
  skip: z.boolean().default(false),
  forumId: optionalText(40),
  courtCaseNo: optionalText(80),
  eccmisNo: optionalText(80),
  eccmisUrl: optionalText(300),
  judge: optionalText(120),
});
export type ForumStep = z.infer<typeof forumStepSchema>;

const partyRowSchema = z.object({
  name: z.string().trim().min(1),
  counselName: optionalText(120),
  counselFirm: optionalText(120),
  email: optionalText(120),
  phone: optionalText(40),
});
export type PartyRow = z.infer<typeof partyRowSchema>;

const witnessRowSchema = z.object({ name: z.string().trim().min(1), phone: optionalText(40) });

export const partiesStepSchema = z.object({
  opposing: z.array(partyRowSchema).default([]),
  witnesses: z.array(witnessRowSchema).default([]),
  internalContactName: optionalText(120),
  internalContactDepartment: optionalText(80),
});
export type PartiesStep = z.infer<typeof partiesStepSchema>;

export const factsStepSchema = z.object({
  description: optionalText(2000),
  amountClaimed: optionalText(20).refine((v) => !v || /^\d+$/.test(v), "Whole number only"),
  amountAgainst: optionalText(20).refine((v) => !v || /^\d+$/.test(v), "Whole number only"),
  causeOfActionDate: optionalText(10),
  referralNote: optionalText(2000),
});
export type FactsStep = z.infer<typeof factsStepSchema>;

export const assignStepSchema = z.object({
  leadUserId: z.string().min(1, "Choose a lead lawyer"),
  supportUserIds: z.array(z.string()).default([]),
  stageTemplateId: z.string().min(1, "Choose a starting stage"),
});
export type AssignStep = z.infer<typeof assignStepSchema>;

export const createMatterSchema = z.object({
  basics: basicsSchema,
  forum: forumStepSchema,
  parties: partiesStepSchema,
  facts: factsStepSchema,
  assign: assignStepSchema,
});
export type CreateMatterInput = z.infer<typeof createMatterSchema>;

/** The wizard's autosaved shape — every step optional/partial while the Admin is mid-draft. */
export type WizardData = {
  basics?: Partial<Basics>;
  forum?: Partial<ForumStep>;
  parties?: Partial<PartiesStep>;
  facts?: Partial<FactsStep>;
  assign?: Partial<AssignStep>;
};
