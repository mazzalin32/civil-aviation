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
  // TEMPORARY, testing only — spec requires 2FA on every account. Must be true before go-live.
  REQUIRE_2FA: z.stringbool().default(true),
  // Shared password for every lawyer on this prototype (invite email + login). Leave empty
  // to keep the real invite-link / pick-your-own-password flow.
  DEMO_LOGIN_PASSWORD: z.string().optional(),
  // TEMPORARY, testing only — spec requires the seeded Admin's temp password be changed at
  // first login (§5.1). Must be true before go-live.
  REQUIRE_PASSWORD_CHANGE: z.stringbool().default(true),
  // Private storage root for encrypted document bytes — never served directly (spec §9).
  // Local filesystem in dev. In production (Vercel's filesystem is read-only outside a
  // per-invocation /tmp that isn't shared across instances) set BLOB_READ_WRITE_TOKEN
  // (Vercel Blob, connected from the project's Storage tab) to switch storage.ts over to it.
  DOCUMENT_STORAGE_DIR: z.string().default("./storage/documents"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  // 32-byte base64 master key wrapping each file's per-document data key (envelope encryption).
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  DOCUMENT_MASTER_KEY: z.string().min(1, "Set DOCUMENT_MASTER_KEY — see .env.example"),
  CLAMAV_HOST: z.string().default("localhost"),
  CLAMAV_PORT: z.coerce.number().default(3310),
  // TEMPORARY, testing only — spec requires every upload virus-scanned before use. Must be
  // true before go-live; false only lets local dev work without a running clamd.
  REQUIRE_VIRUS_SCAN: z.stringbool().default(true),
  // Video calls in the case Discussion tab (LiveKit Cloud). All three optional together —
  // the "Start call" UI just stays hidden when they're not set, rather than erroring.
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
});

export const env = schema.parse(process.env);
