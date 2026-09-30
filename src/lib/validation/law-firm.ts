import { z } from "zod";

export const lawFirmSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
