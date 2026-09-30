import { z } from "zod";

export const groupMessageSchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(4000),
});
