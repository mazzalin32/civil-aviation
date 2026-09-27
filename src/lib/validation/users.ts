import { z } from "zod";

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const createLawyerSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  email: z.email(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  title: z.string().trim().max(80).optional().or(z.literal("")),
  department: z.string().trim().max(80).optional().or(z.literal("")),
  practisingCertNo: z.string().trim().max(40).optional().or(z.literal("")),
  certExpiry: optionalDate,
});

export const updateLawyerSchema = createLawyerSchema.omit({ email: true }).extend({
  id: z.string().min(1),
});
