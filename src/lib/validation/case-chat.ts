import { z } from "zod";

export const MAX_CHAT_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB

export const postCaseMessageSchema = z.object({
  matterId: z.string().min(1, "Matter ID is required"),
  body: z.string().trim().max(4000, "Message cannot exceed 4000 characters").default(""),
  attachedDocumentIds: z.array(z.string()).optional().default([]),
  mentionedUserIds: z.array(z.string()).optional().default([]),
});

export const togglePinMessageSchema = z.object({
  matterId: z.string().min(1),
  messageId: z.string().min(1),
  isPinned: z.boolean(),
});

export const deleteCaseMessageSchema = z.object({
  matterId: z.string().min(1),
  messageId: z.string().min(1),
});

export type PostCaseMessageInput = z.infer<typeof postCaseMessageSchema>;
export type TogglePinMessageInput = z.infer<typeof togglePinMessageSchema>;
export type DeleteCaseMessageInput = z.infer<typeof deleteCaseMessageSchema>;
