import { z } from "zod";

export const messageSchema = z.object({
  matterId: z.string().min(1),
  body: z.string().trim().min(1, "Write a message").max(4000),
});
