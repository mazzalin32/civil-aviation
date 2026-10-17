import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").optional().or(z.literal(""));

/** Short intake for a Contract matter — deliberately not the 9-step litigation wizard, since
 * service/court/CAA-position fields don't apply to a contract (client feedback 2026-10-15). */
export const createContractSchema = z.object({
  title: z.string().trim().min(3, "Enter the contract title").max(200),
  categoryId: z.string().min(1, "Choose the nature of the contract"),
  counterpartyName: z.string().trim().min(1, "Enter the counterparty's name").max(160),
  originatingDepartment: optionalText(120),
  dateOfReceipt: optionalDate,
  leadUserId: z.string().min(1, "Choose the responsible legal officer"),
  commencementDate: optionalDate,
  expiryDate: optionalDate,
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

/** The five parallel tracking statuses, execution and key dates — edited from the contract's
 * own detail page, not the litigation wizard (Contracts are fully independent of Matter). */
export const updateContractSchema = z.object({
  contractId: z.string().min(1),
  originatingDepartment: optionalText(120),
  dateOfReceipt: optionalDate,
  dateSubmittedForReview: optionalDate,
  receiptStatusId: optionalText(40),
  legalReviewStatusId: optionalText(40),
  internalApprovalStatusId: optionalText(40),
  agVettingStatusId: optionalText(40),
  amendmentsStatusId: optionalText(40),
  caaExecutionStatus: z.enum(["PENDING", "SIGNED"]).default("PENDING"),
  counterpartyExecutionStatus: z.enum(["PENDING", "SIGNED"]).default("PENDING"),
  dateOfSignature: optionalDate,
  dateOfFullExecution: optionalDate,
  commencementDate: optionalDate,
  expiryDate: optionalDate,
  outstandingAction: optionalText(500),
  sourceUrl: z.string().trim().url("Enter a valid URL").max(500).optional().or(z.literal("")),
});

export const moveContractStageSchema = z.object({
  contractId: z.string().min(1),
  stageId: z.string().min(1, "Choose a stage"),
});

export const reassignContractSchema = z.object({
  contractId: z.string().min(1),
  leadUserId: z.string().min(1, "Choose a lead lawyer"),
  supportUserIds: z.array(z.string()).default([]),
});
