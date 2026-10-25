"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { Role } from "@/generated/prisma/client";
import { createOrganizationSchema, updateOrganizationSchema, inviteAdminSchema } from "@/lib/validation/organization";
import { demoLoginPassword, setDemoLoginPassword } from "@/lib/demo-login";
import { sendLawyerReadyEmail } from "@/lib/mailer";

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

async function sendAdminInvite(user: { id: string; email: string; name: string }) {
  const shared = demoLoginPassword();
  if (shared) {
    await setDemoLoginPassword(user.id);
    await sendLawyerReadyEmail(user.email, user.name, shared);
    return;
  }
  await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/activate" }, headers: await headers(), asResponse: false });
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

  await sendAdminInvite(created);
  await writeAudit({ userId: superadmin.id, action: "user.invite.sent", entity: "User", entityId: created.id });

  revalidatePath(`/superadmin/${organizationId}`);
}
