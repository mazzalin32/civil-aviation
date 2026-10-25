"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { Role } from "@/generated/prisma/client";
import { createLawyerSchema, updateLawyerSchema } from "@/lib/validation/users";
import { demoLoginPassword, setDemoLoginPassword } from "@/lib/demo-login";
import { sendLawyerReadyEmail } from "@/lib/mailer";

async function reload() {
  revalidatePath("/users");
}

function fields(data: { phone?: string; title?: string; department?: string; practisingCertNo?: string; certExpiry: Date | null }) {
  return {
    phone: data.phone || null,
    title: data.title || null,
    department: data.department || null,
    practisingCertNo: data.practisingCertNo || null,
    certExpiry: data.certExpiry,
  };
}

async function sendInvite(user: { id: string; email: string; name: string }) {
  const shared = demoLoginPassword();
  if (shared) {
    await setDemoLoginPassword(user.id);
    await sendLawyerReadyEmail(user.email, user.name, shared);
    return;
  }
  await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/activate" }, headers: await headers(), asResponse: false });
}

/** Creates the account and sends the invite (shared prototype password, or the real reset link). */
export async function createLawyer(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = createLawyerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    title: formData.get("title"),
    department: formData.get("department"),
    practisingCertNo: formData.get("practisingCertNo"),
    certExpiry: formData.get("certExpiry"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing && !existing.deletedAt) return { error: "Someone with this email already has an account." };

  // A previously deleted account is brought back (same history) instead of colliding on the unique email.
  const created = existing
    ? await db.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, deletedAt: null, isActive: true, organizationId: admin.organizationId, ...fields(parsed.data) } })
    : await db.user.create({ data: { name: parsed.data.name, email: parsed.data.email, role: Role.LAWYER, organizationId: admin.organizationId, ...fields(parsed.data) } });
  await writeAudit({ userId: admin.id, action: existing ? "user.restore" : "user.create", entity: "User", entityId: created.id, after: { name: created.name, email: created.email } });

  await sendInvite(created);
  await writeAudit({ userId: admin.id, action: "user.invite.sent", entity: "User", entityId: created.id });

  await reload();
}

/** Resends the same invite/reset link — useful if the first one expired or was missed. */
export async function resendInvite(id: string) {
  const admin = await requireRole("ADMIN");
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return;
  await sendInvite(user);
  await writeAudit({ userId: admin.id, action: "user.invite.resent", entity: "User", entityId: id });
  await reload();
}

export async function updateLawyer(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const parsed = updateLawyerSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    title: formData.get("title"),
    department: formData.get("department"),
    practisingCertNo: formData.get("practisingCertNo"),
    certExpiry: formData.get("certExpiry"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };

  const { id, name, ...rest } = parsed.data;
  const before = await db.user.findUnique({ where: { id } });
  const updated = await db.user.update({ where: { id }, data: { name, ...fields(rest) } });
  await writeAudit({ userId: admin.id, action: "user.update", entity: "User", entityId: id, before, after: updated });
  await reload();
}

/**
 * Deactivate/reactivate. Never a hard delete (CLAUDE.md). Deactivating also revokes
 * every session, per FLOWS §19. Reassigning their open matters happens here too from
 * Phase 4 on — there's nothing to reassign until Matter exists.
 */
export async function toggleUserActive(id: string, isActive: boolean) {
  const admin = await requireRole("ADMIN");
  if (id === admin.id) return { error: "You can't deactivate your own account." };

  const before = await db.user.findUnique({ where: { id } });
  const updated = await db.user.update({ where: { id }, data: { isActive } });
  if (!isActive) await db.session.deleteMany({ where: { userId: id } });
  await writeAudit({
    userId: admin.id,
    action: isActive ? "user.reactivate" : "user.deactivate",
    entity: "User",
    entityId: id,
    before,
    after: updated,
  });
  await reload();
}

/** "Sign out all sessions" — e.g. a lost laptop (FLOWS §19). Doesn't deactivate the account. */
export async function signOutAllSessions(id: string) {
  const admin = await requireRole("ADMIN");
  await db.session.deleteMany({ where: { userId: id } });
  await writeAudit({ userId: admin.id, action: "user.sessions.revoked", entity: "User", entityId: id });
  await reload();
}

/**
 * "Delete" a user. Never a hard delete (CLAUDE.md) — their history (cases, audit log, messages)
 * must stay intact, so the account is hidden from every list, signed out everywhere, and its
 * password removed. Re-adding the same email later restores it. Refused while they still lead
 * an open case, because that case would be left without a responsible lawyer.
 */
export async function deleteUser(id: string) {
  const admin = await requireRole("ADMIN");
  if (id === admin.id) return { error: "You can't delete your own account." };

  const user = await db.user.findUnique({ where: { id } });
  if (!user || user.deletedAt) return { error: "That user no longer exists." };

  const leading = await db.matterAssignment.count({
    where: { userId: id, role: "LEAD", removedAt: null, matter: { deletedAt: null, status: { in: ["OPEN", "ON_HOLD", "CLOSURE_REQUESTED"] } } },
  });
  if (leading > 0) return { error: `${user.name} is the lead on ${leading} open case${leading === 1 ? "" : "s"}. Reassign ${leading === 1 ? "it" : "them"} first (Cases → Reassign), then delete.` };

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.account.deleteMany({ where: { userId: id } });
    await tx.matterAssignment.updateMany({ where: { userId: id, removedAt: null }, data: { removedAt: new Date() } });
    await writeAudit({ userId: admin.id, action: "user.delete", entity: "User", entityId: id, before: { name: user.name, email: user.email } }, tx);
  });
  await reload();
}
