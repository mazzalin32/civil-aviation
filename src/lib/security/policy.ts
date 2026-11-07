import { z } from "zod";

/**
 * Mass-download policy (spec §5.9 "suspicious activity", FLOWS §15). Pure — no database — so it is
 * unit-tested on its own. The live values are Admin data (Setting `security.massDownload`, edited in
 * Settings → Security); these defaults only apply until an Admin saves their own, or if the stored
 * value is unreadable.
 */
export const MASS_DOWNLOAD_SETTING = "security.massDownload";

export const massDownloadPolicySchema = z.object({
  files: z.coerce.number().int("Whole numbers only").min(5, "At least 5 files").max(10_000, "At most 10,000 files"),
  minutes: z.coerce.number().int("Whole numbers only").min(1, "At least 1 minute").max(1_440, "At most 1,440 minutes (a day)"),
  autoLock: z.boolean(),
});

export type MassDownloadPolicy = z.infer<typeof massDownloadPolicySchema>;

/** FLOWS §15's example ("50 downloads in 10 min"); auto-lock off so a lawyer preparing a court bundle isn't cut off. */
export const DEFAULT_MASS_DOWNLOAD: MassDownloadPolicy = { files: 50, minutes: 10, autoLock: false };

export function readMassDownloadPolicy(stored: unknown): MassDownloadPolicy {
  const parsed = massDownloadPolicySchema.safeParse(stored);
  return parsed.success ? parsed.data : DEFAULT_MASS_DOWNLOAD;
}

/** Only lawyers are ever locked automatically — locking an Admin could leave nobody able to unlock anyone. */
export function shouldAutoLock(policy: MassDownloadPolicy, role: string): boolean {
  return policy.autoLock && role === "LAWYER";
}
