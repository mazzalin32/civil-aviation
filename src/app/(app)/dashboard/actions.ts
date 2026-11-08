"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";

/** Closes the first-sign-in welcome card (FLOWS §3) for good. Takes no input — only ever the caller's own account. */
export async function dismissWelcome() {
  const me = await requireRole("ADMIN", "LAWYER");
  const { count } = await db.user.updateMany({ where: { id: me.id, welcomeDismissedAt: null }, data: { welcomeDismissedAt: new Date() } });
  if (count > 0) await writeAudit({ userId: me.id, action: "user.welcome.dismissed", entity: "User", entityId: me.id });
  revalidatePath("/dashboard");
}
