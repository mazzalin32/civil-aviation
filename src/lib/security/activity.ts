import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { writeAudit } from "../audit";
import { db } from "../db";
import { notify } from "../notify";
import { MASS_DOWNLOAD_SETTING, readMassDownloadPolicy, shouldAutoLock, type MassDownloadPolicy } from "./policy";

/**
 * Suspicious-activity alerts (spec §5.9, FLOWS §15): many files taken in a short time, and an account
 * locked by failed sign-ins. Both go to the Admins of the person's own organisation only, as a
 * SUSPICIOUS_ACTIVITY notification (always on — an Admin can't mute security alerts).
 */

type Who = { id: string; name: string; email: string; role: string; organizationId: string | null };

const TRIGGER = "SUSPICIOUS_ACTIVITY";

export async function getMassDownloadPolicy(): Promise<MassDownloadPolicy> {
  const row = await db.setting.findUnique({ where: { key: MASS_DOWNLOAD_SETTING } });
  return readMassDownloadPolicy(row?.value);
}

/** Different files this person opened, downloaded or printed since `since` — case documents, contract documents and chat attachments. */
async function distinctFilesSince(userId: string, since: Date): Promise<number> {
  const [row] = await db.$queryRaw<{ n: number }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT f)::int AS n FROM (
      SELECT 'doc:' || "documentId" AS f FROM "DocumentAccessLog" WHERE "userId" = ${userId} AND "at" > ${since}
      UNION ALL
      SELECT 'contract:' || "documentId" FROM "ContractDocumentAccessLog" WHERE "userId" = ${userId} AND "at" > ${since}
      UNION ALL
      SELECT 'chat:' || "entityId" FROM "AuditLog" WHERE "userId" = ${userId} AND "action" LIKE 'chat.attachment.%' AND "createdAt" > ${since}
    ) files
  `);
  return row?.n ?? 0;
}

async function adminsToTell(who: Who): Promise<string[]> {
  if (!who.organizationId) return [];
  const admins = await db.user.findMany({
    where: { organizationId: who.organizationId, role: "ADMIN", isActive: true, deletedAt: null, id: { not: who.id } },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/**
 * Call after a file has been served and logged. Alerts the Admins once per window when the person
 * crosses the limit, and — only if the Admin turned auto-lock on — deactivates and signs out a lawyer's
 * account. Returns `locked: true` so the caller can refuse the request that tipped it over.
 *
 * Never throws: a failure here must not break ordinary document access; it is logged instead.
 */
export async function checkMassDownload(who: Who): Promise<{ locked: boolean }> {
  try {
    const policy = await getMassDownloadPolicy();
    const now = new Date();
    const since = new Date(now.getTime() - policy.minutes * 60_000);
    const files = await distinctFilesSince(who.id, since);
    if (files < policy.files) return { locked: false };

    // One alert per window per person: the files keep coming while the limit is exceeded.
    const prefix = `SUSPICIOUS_DOWNLOADS:${who.id}:`;
    const recent = await db.reminderLog.findFirst({ where: { key: { startsWith: prefix }, createdAt: { gt: since } } });
    if (recent) return { locked: false };
    const { count } = await db.reminderLog.createMany({ data: [{ key: `${prefix}${now.toISOString()}` }], skipDuplicates: true });
    if (count !== 1) return { locked: false };

    const lock = shouldAutoLock(policy, who.role);
    if (lock) {
      await db.user.update({ where: { id: who.id }, data: { isActive: false } });
      await db.session.deleteMany({ where: { userId: who.id } });
    }
    await writeAudit({
      userId: null,
      action: lock ? "security.massDownload.locked" : "security.massDownload.alert",
      entity: "User",
      entityId: who.id,
      after: { files, minutes: policy.minutes, limit: policy.files, locked: lock },
    });

    const message =
      `${who.name} (${who.email}) opened or downloaded ${files} different files in the last ${policy.minutes} minutes.` +
      (lock ? " The account has been deactivated and signed out everywhere until an Admin re-activates it from Users." : " Check that this was expected.");
    for (const userId of await adminsToTell(who)) {
      await notify({
        userId,
        type: TRIGGER,
        subject: lock ? `Account locked: unusual downloads by ${who.name}` : `Unusual downloads by ${who.name}`,
        message,
        url: `/users/${who.id}`,
        payload: { kind: "massDownload", subjectUserId: who.id, files, minutes: policy.minutes, locked: lock },
      });
    }
    return { locked: lock };
  } catch (err) {
    console.error(`security: mass-download check failed for ${who.id}`, err);
    return { locked: false };
  }
}

/** An account just locked itself after too many failed sign-ins (src/lib/lockout.ts) — tell its organisation's Admins. */
export async function alertAccountLocked(who: Who, attempts: number, minutes: number) {
  try {
    for (const userId of await adminsToTell(who)) {
      await notify({
        userId,
        type: TRIGGER,
        subject: `Account locked: ${who.name}`,
        message: `${who.name} (${who.email}) was locked out for ${minutes} minutes after ${attempts} failed sign-in attempts.`,
        url: `/users/${who.id}`,
        payload: { kind: "failedLogins", subjectUserId: who.id, attempts },
      });
    }
  } catch (err) {
    console.error(`security: lockout alert failed for ${who.id}`, err);
  }
}
