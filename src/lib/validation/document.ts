import { z } from "zod";

export const uploadDocumentSchema = z.object({
  matterId: z.string().min(1),
  folderId: z.string().min(1, "Choose a folder"),
  confidentiality: z.enum(["NORMAL", "CONFIDENTIAL", "HIGHLY_CONFIDENTIAL"]),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  linkedEventId: z.string().optional().or(z.literal("")),
});

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB
