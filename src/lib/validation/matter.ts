import { z } from "zod";

/** CAA's position in the matter, in the order shown on the intake. Values match the UcaaRole enum. */
export const UCAA_POSITIONS = [
  { value: "PLAINTIFF", label: "Plaintiff", against: "Who is CAA suing?" },
  { value: "CLAIMANT", label: "Claimant", against: "Who is CAA claiming against?" },
  { value: "APPLICANT", label: "Applicant", against: "Who is CAA applying against?" },
  { value: "PETITIONER", label: "Petitioner", against: "Who is CAA petitioning against?" },
  { value: "DEFENDANT", label: "Defendant", against: "Who is bringing the matter against CAA?" },
  { value: "RESPONDENT", label: "Respondent", against: "Who is bringing the matter against CAA?" },
  { value: "INTERESTED_PARTY", label: "Interested Party", against: "Who is the main other party?" },
  { value: "APPELLANT", label: "Appellant", against: "Who is CAA appealing against?" },
  { value: "RESPONDENT_TO_APPEAL", label: "Respondent to Appeal", against: "Who is appealing against CAA?" },
  { value: "ADVISOR", label: "Advisor", against: "Who is the advice for or about?" },
  { value: "OTHER", label: "Other", against: "Who is the main other party?" },
] as const;
export const UCAA_ROLES = UCAA_POSITIONS.map((p) => p.value) as unknown as readonly [(typeof UCAA_POSITIONS)[number]["value"], ...(typeof UCAA_POSITIONS)[number]["value"][]];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const CONFIDENTIALITIES = ["NORMAL", "CONFIDENTIAL", "HIGHLY_CONFIDENTIAL"] as const;
export const SERVICE_DIRECTIONS = ["CAA_SERVING", "CAA_SERVED", "NOT_YET_SERVED"] as const;

export const REPORTED_BY = ["CAA department", "CAA management", "Court or tribunal registry", "Opposing party", "External law firm", "Government ministry or agency", "Other"] as const;
export const REPORT_METHODS = ["In person / hand delivery", "Email", "Letter", "Telephone", "Court service", "Internal memo", "Other"] as const;
export const PROCESS_NATURES = ["Summons", "Plaint", "Notice of motion", "Application", "Statutory notice", "Demand letter", "Notice of appeal", "Petition", "Other"] as const;
export const PARTY_TYPES = ["Individual", "Company", "Government body", "Non-profit", "Other"] as const;
export const JURISDICTIONS = ["Civil", "Criminal", "Commercial", "Employment / Industrial", "Constitutional", "Administrative", "Arbitration", "Other"] as const;
export const REPRESENTATION_STATUSES = ["In-house counsel", "External counsel", "In-house and external counsel", "Not yet assigned"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").optional().or(z.literal(""));

/** Step 1 — Matter identification. The reference itself is generated on submit, never typed. */
export const identificationSchema = z.object({
  title: z.string().trim().min(3, "Enter the matter title").max(200),
  categoryId: z.string().min(1, "Choose a category"),
  matterTypeId: z.string().min(1, "Choose a matter type"),
  reportedDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date reported"),
  reportedTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "Use a valid time").optional().or(z.literal("")),
  reportedBy: optionalText(80),
  reportMethod: optionalText(80),
  description: optionalText(2000),
});
export type Identification = z.infer<typeof identificationSchema>;

/** Step 2 — CAA position and the main other party. */
export const positionSchema = z.object({
  ucaaRole: z.enum(UCAA_ROLES, { error: "Choose CAA's position" }),
  partyName: optionalText(160),
  partyType: optionalText(40),
  partyContact: optionalText(160),
  partyAddress: optionalText(240),
});
export type Position = z.infer<typeof positionSchema>;

/** Step 3 — Service / legal process. Every field is optional because service may not have happened yet. */
export const serviceSchema = z.object({
  direction: z.enum(SERVICE_DIRECTIONS).default("NOT_YET_SERVED"),
  processNature: optionalText(60),
  issuedAt: optionalDate,
  receivedAt: optionalDate,
  responseDeadline: optionalDate,
  receivedBy: optionalText(120),
  recipientId: optionalText(40),
});
export type Service = z.infer<typeof serviceSchema>;

/** Step 4 — Other parties to the matter (witnesses, interested parties…). */
export const partyRowSchema = z.object({
  name: optionalText(160),
  organisation: optionalText(160),
  partyType: optionalText(40),
  role: optionalText(120),
});
export type PartyRow = z.infer<typeof partyRowSchema>;
export const partiesSchema = z.object({ rows: z.array(partyRowSchema).default([]) });
export type Parties = z.infer<typeof partiesSchema>;

/** Step 5 — Court & judicial information. `skip` = not before a court/tribunal yet. */
export const courtSchema = z.object({
  skip: z.boolean().default(false),
  forumId: optionalText(40),
  courtStation: optionalText(120),
  courtCaseNo: optionalText(80),
  filedAt: optionalDate,
  jurisdiction: optionalText(60),
  judge: optionalText(120),
  eccmisNo: optionalText(80),
  eccmisUrl: optionalText(300),
});
export type Court = z.infer<typeof courtSchema>;

/** Step 6 — Legal representation: who is responsible internally, and any external counsel. */
export const representationSchema = z.object({
  representationStatus: optionalText(60),
  leadUserId: z.string().min(1, "Choose the responsible legal officer"),
  supportUserIds: z.array(z.string()).default([]),
  externalCounselName: optionalText(160),
  externalCounselContact: optionalText(160),
});
export type Representation = z.infer<typeof representationSchema>;

/** Step 7 — Matter stage, priority and the immediate next action. */
export const stageSchema = z.object({
  stageTemplateId: z.string().min(1, "Choose the current stage"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  confidentiality: z.enum(CONFIDENTIALITIES).default("NORMAL"),
  nextActionDue: optionalDate,
  internalNotes: optionalText(2000),
});
export type Stage = z.infer<typeof stageSchema>;

export const createMatterSchema = z.object({
  identification: identificationSchema,
  position: positionSchema,
  service: serviceSchema,
  parties: partiesSchema,
  court: courtSchema,
  representation: representationSchema,
  stage: stageSchema,
});
export type CreateMatterInput = z.infer<typeof createMatterSchema>;

/** The wizard's autosaved shape — every step partial while the Admin is mid-draft. `v` lets us discard drafts from the old 5-step wizard. */
export type WizardData = {
  v?: 2;
  identification?: Partial<Identification>;
  position?: Partial<Position>;
  service?: Partial<Service>;
  parties?: Partial<Parties>;
  court?: Partial<Court>;
  representation?: Partial<Representation>;
  stage?: Partial<Stage>;
};
