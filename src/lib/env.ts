import { z } from "zod";

/**
 * Server environment, validated once. Variables join this schema in the phase that
 * first needs them, so a missing value fails fast instead of at first use.
 */
const schema = z.object({
  DATABASE_URL: z.url(),
  APP_URL: z.url().default("http://localhost:3000"),
});

export const env = schema.parse(process.env);
