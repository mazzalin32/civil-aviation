import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "./auth";

/**
 * Emails a 2FA code, collapsing accidental duplicates.
 *
 * The "first code" is sent as a side effect of opening a screen (the /2fa page render, the
 * setup wizard's mount effect). Those can run twice for one visit — React Strict Mode in dev,
 * re-renders — and every send overwrites the previous code (Better Auth keeps one per user),
 * so the user ends up with two emails and the first one's code is already dead.
 *
 * Calls for the same browser (keyed on its cookies) within DEDUPE_MS share one send.
 * Pass `force: true` for an explicit user "Resend" — the UI already enforces a cooldown.
 * In-memory, so per server instance; a rare duplicate across instances is harmless.
 */
const DEDUPE_MS = 5_000;
const recent = new Map<string, { at: number; promise: Promise<void> }>();

export async function sendTwoFactorOtpOnce({ force = false }: { force?: boolean } = {}): Promise<void> {
  const hdrs = await headers();
  const key = createHash("sha256").update(hdrs.get("cookie") ?? "").digest("hex");
  const now = Date.now();

  for (const [k, v] of recent) if (now - v.at > DEDUPE_MS) recent.delete(k);

  const existing = recent.get(key);
  if (!force && existing) return existing.promise;

  const promise = auth.api.sendTwoFactorOTP({ headers: hdrs, asResponse: false }).then(() => undefined);
  recent.set(key, { at: now, promise });
  // A failed send must not block a retry.
  promise.catch(() => recent.delete(key));
  return promise;
}
