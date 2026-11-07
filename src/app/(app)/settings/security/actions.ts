"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { MASS_DOWNLOAD_SETTING, massDownloadPolicySchema } from "@/lib/security/policy";
import { getMassDownloadPolicy } from "@/lib/security/activity";

export type SecurityFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Settings → Security: the mass-download alert limit and whether it locks the account (spec §5.9, FLOWS §15). */
export async function updateMassDownloadPolicy(input: unknown): Promise<SecurityFormState> {
  const admin = await requireRole("ADMIN");
  const parsed = massDownloadPolicySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const before = await getMassDownloadPolicy();
  const value = parsed.data as unknown as Prisma.InputJsonValue;
  await db.setting.upsert({
    where: { key: MASS_DOWNLOAD_SETTING },
    update: { value, updatedById: admin.id },
    create: { key: MASS_DOWNLOAD_SETTING, value, updatedById: admin.id },
  });
  await writeAudit({ userId: admin.id, action: "setting.security.massDownload.update", entity: "Setting", entityId: MASS_DOWNLOAD_SETTING, before, after: parsed.data });
  revalidatePath("/settings/security");
  return { ok: true };
}
