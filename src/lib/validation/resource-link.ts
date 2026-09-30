import { z } from "zod";

export const resourceLinkSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  url: z.string().trim().url("Enter a valid URL (include https://)").max(500),
  category: z.string().trim().max(80).optional().or(z.literal("")),
});
