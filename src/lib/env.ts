import { z } from "zod";

/**
 * Server environment, validated once. Variables join this schema in the phase that
 * first needs them, so a missing value fails fast instead of at first use.
 */
const schema = z.object({
  DATABASE_URL: z.url(),
  APP_URL: z.url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(16),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("CAA Legal <no-reply@caa.go.ug>"),
});

export const env = schema.parse(process.env);
