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
