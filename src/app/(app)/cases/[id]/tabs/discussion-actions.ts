"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMatterAccess } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { messageSchema } from "@/lib/validation/discussion";

export async function postMessage(raw: unknown): Promise<{ error?: string } | void> {
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Write a message." };
  const { matterId, body } = parsed.data;
  const user = await requireMatterAccess(matterId);

  const row = await db.matterMessage.create({ data: { matterId, authorId: user.id, body } });
  await db.matter.update({ where: { id: matterId }, data: { lastActivityAt: new Date() } });
  await writeAudit({ userId: user.id, action: "message.post", entity: "MatterMessage", entityId: row.id, after: { matterId } });
  revalidatePath(`/cases/${matterId}`);
}
