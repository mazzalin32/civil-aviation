"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { Role } from "@/generated/prisma/client";
import { createOrganizationSchema, updateOrganizationSchema, inviteAdminSchema } from "@/lib/validation/organization";
import { sendInvite } from "@/lib/invites";

type ActionResult = { error: string } | void;
type CreateOrgResult = { error: string } | { organizationId: string };

export async function createOrganization(raw: unknown): Promise<CreateOrgResult> {
  const superadmin = await requireRole("SUPERADMIN");
  const parsed = createOrganizationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { name, logoUrl, primaryColor } = parsed.data;

  const existing = await db.organization.findUnique({ where: { name } });
  if (existing) return { error: "An organisation with this name already exists." };

  const org = await db.organization.create({ data: { name, logoUrl: logoUrl || null, primaryColor: primaryColor || null } });
  await writeAudit({ userId: superadmin.id, action: "organization.create", entity: "Organization", entityId: org.id, after: { name: org.name } });

  revalidatePath("/superadmin");
  return { organizationId: org.id };
}

export async function updateOrganization(raw: unknown): Promise<ActionResult> {
  const superadmin = await requireRole("SUPERADMIN");
  const parsed = updateOrganizationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { id, name, logoUrl, primaryColor } = parsed.data;

  await db.organization.update({ where: { id }, data: { name, logoUrl: logoUrl || null, primaryColor: primaryColor || null } });
  await writeAudit({ userId: superadmin.id, action: "organization.update", entity: "Organization", entityId: id, after: { name, logoUrl, primaryColor } });

  revalidatePath(`/superadmin/${id}`);
  revalidatePath("/superadmin");
}

/** Superadmin invites the first (or another) Admin for an organisation — same invite-link
 * mechanism as an Admin inviting a lawyer (spec §4), just one tier up. */
export async function inviteAdmin(raw: unknown): Promise<ActionResult> {
  const superadmin = await requireRole("SUPERADMIN");
  const parsed = inviteAdminSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { organizationId, name, email } = parsed.data;

  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) return { error: "Organisation not found." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt) return { error: "Someone with this email already has an account." };

  const created = existing
    ? await db.user.update({ where: { id: existing.id }, data: { name, role: Role.ADMIN, organizationId, deletedAt: null, isActive: true } })
    : await db.user.create({ data: { name, email, role: Role.ADMIN, organizationId } });
  await writeAudit({ userId: superadmin.id, action: existing ? "user.restore" : "user.create", entity: "User", entityId: created.id, after: { name: created.name, email: created.email, role: "ADMIN" } });

  await sendInvite(created);
  await writeAudit({ userId: superadmin.id, action: "user.invite.sent", entity: "User", entityId: created.id });

  revalidatePath(`/superadmin/${organizationId}`);
}

/** Fresh invite link for an organisation's Admin who hasn't chosen a password yet; the old link stops working. */
export async function resendAdminInvite(raw: unknown): Promise<ActionResult> {
  const superadmin = await requireRole("SUPERADMIN");
  const parsed = z.string().min(1).max(64).safeParse(raw);
  if (!parsed.success) return { error: "That Admin no longer exists." };

  const user = await db.user.findUnique({ where: { id: parsed.data }, include: { accounts: { where: { providerId: "credential" }, select: { id: true } } } });
  if (!user || user.role !== Role.ADMIN || user.deletedAt) return { error: "That Admin no longer exists." };
  if (!user.isActive) return { error: `${user.name}'s account is deactivated.` };
  if (user.accounts.length > 0) return { error: `${user.name} has already set a password. They can use "Forgot password" on the sign-in page.` };

  await sendInvite(user);
  await writeAudit({ userId: superadmin.id, action: "user.invite.resent", entity: "User", entityId: user.id });
  revalidatePath(`/superadmin/${user.organizationId}`);
}
