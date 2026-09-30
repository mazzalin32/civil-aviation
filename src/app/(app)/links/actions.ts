"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { resourceLinkSchema } from "@/lib/validation/resource-link";

type ActionResult = { error?: string } | void;

export async function addResourceLink(raw: unknown): Promise<ActionResult> {
  const parsed = resourceLinkSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { title, url, category } = parsed.data;
  const user = await requireRole();

  const link = await db.resourceLink.create({ data: { title, url, category: category || null, addedById: user.id } });
  await writeAudit({ userId: user.id, action: "resourcelink.create", entity: "ResourceLink", entityId: link.id, after: { title, url } });
  revalidatePath("/links");
}

export async function deleteResourceLink(id: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  await db.resourceLink.delete({ where: { id } });
  await writeAudit({ userId: user.id, action: "resourcelink.delete", entity: "ResourceLink", entityId: id });
  revalidatePath("/links");
}
