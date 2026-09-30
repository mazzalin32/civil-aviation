"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { groupMessageSchema } from "@/lib/validation/group-chat";

type ActionResult = { error?: string } | void;

export async function postGroupMessage(raw: unknown): Promise<ActionResult> {
  const parsed = groupMessageSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the message." };
  const user = await requireRole();

  const message = await db.groupMessage.create({ data: { authorId: user.id, body: parsed.data.body } });
  await writeAudit({ userId: user.id, action: "groupchat.post", entity: "GroupMessage", entityId: message.id });
  revalidatePath("/chat");
}
