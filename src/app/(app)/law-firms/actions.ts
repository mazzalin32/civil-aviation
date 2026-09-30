"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { lawFirmSchema } from "@/lib/validation/law-firm";

type ActionResult = { error?: string } | void;

export async function saveLawFirm(raw: unknown): Promise<ActionResult> {
  const parsed = lawFirmSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { id, name, contactName, phone, email, address, notes } = parsed.data;
  const user = await requireRole();

  const data = {
    name,
    contactName: contactName || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    notes: notes || null,
  };

  if (id) {
    await db.lawFirm.update({ where: { id }, data });
    await writeAudit({ userId: user.id, action: "lawfirm.update", entity: "LawFirm", entityId: id, after: { name } });
  } else {
    const firm = await db.lawFirm.create({ data: { ...data, addedById: user.id } });
    await writeAudit({ userId: user.id, action: "lawfirm.create", entity: "LawFirm", entityId: firm.id, after: { name } });
  }
  revalidatePath("/law-firms");
}

export async function setLawFirmActive(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  await db.lawFirm.update({ where: { id }, data: { isActive } });
  await writeAudit({ userId: user.id, action: isActive ? "lawfirm.restore" : "lawfirm.deactivate", entity: "LawFirm", entityId: id });
  revalidatePath("/law-firms");
}
