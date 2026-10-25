"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { Role } from "@/generated/prisma/client";
import { demoLoginPassword, setDemoLoginPassword } from "@/lib/demo-login";
import { sendLawyerReadyEmail } from "@/lib/mailer";
import { detectColumns, parseWorkbookToGrid, validateMappedRows, type ColumnMapping, type ParsedRow } from "./parse";

export type PreviewResult =
  | { error: string }
  | { headerRow: string[]; grid: string[][]; mapping: ColumnMapping; rows: ParsedRow[] };

async function existingEmailSet() {
  const users = await db.user.findMany({ select: { email: true } });
  return new Set(users.map((u) => u.email.toLowerCase()));
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  await requireRole("ADMIN");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file first." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Upload the .xlsx template — other formats aren't supported yet." };

  try {
    const buffer = await file.arrayBuffer();
    const { headerRow, grid } = await parseWorkbookToGrid(buffer);
    if (grid.length === 0) return { error: "No data rows found in that file." };
    const mapping = detectColumns(headerRow);
    const rows = validateMappedRows(grid, mapping, await existingEmailSet());
    return { headerRow, grid, mapping, rows };
  } catch {
    return { error: "Couldn't read that file. Make sure it's a valid .xlsx workbook." };
  }
}

/** Called again whenever the Admin adjusts a column mapping — no re-upload needed. */
export async function revalidateGrid(grid: string[][], mapping: ColumnMapping): Promise<ParsedRow[]> {
  await requireRole("ADMIN");
  return validateMappedRows(grid, mapping, await existingEmailSet());
}

export type ConfirmResult = { batchId: string; created: number; skipped: number };

export async function confirmImport(rows: ParsedRow[]): Promise<ConfirmResult | { error: string }> {
  const admin = await requireRole("ADMIN");
  const hdrs = await headers();

  // Re-check against the database at the moment of import, not just at preview time.
  const existing = await existingEmailSet();
  const seen = new Set<string>();
  const toCreate = rows.filter((r) => {
    if (r.errors.length > 0) return false;
    if (existing.has(r.email) || seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
  if (toCreate.length === 0) return { error: "No valid rows to import." };

  const batch = await db.importBatch.create({
    data: { kind: "USERS", rowsTotal: rows.length, rowsOk: 0, rowsFailed: rows.length, details: {}, createdById: admin.id },
  });

  const createdIds: string[] = [];
  for (const r of toCreate) {
    const user = await db.user.create({
      data: {
        name: r.name,
        email: r.email,
        role: Role.LAWYER,
        organizationId: admin.organizationId,
        phone: r.phone || null,
        title: r.title || null,
        department: r.department || null,
        practisingCertNo: r.practisingCertNo || null,
        certExpiry: r.certExpiry ? new Date(r.certExpiry) : null,
        importBatchId: batch.id,
      },
    });
    createdIds.push(user.id);
    const shared = demoLoginPassword();
    if (shared) {
      await setDemoLoginPassword(user.id);
      await sendLawyerReadyEmail(user.email, user.name, shared);
    } else {
      await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/activate" }, headers: hdrs, asResponse: false });
    }
  }

  const createdRowNumbers = new Set(toCreate.map((r) => r.row));
  const failedRows = rows.filter((r) => !createdRowNumbers.has(r.row));
  await db.importBatch.update({
    where: { id: batch.id },
    data: {
      rowsOk: createdIds.length,
      rowsFailed: failedRows.length,
      details: {
        errors: failedRows.map((r) => ({ row: r.row, name: r.name, email: r.email, reasons: r.errors.length > 0 ? r.errors : ["duplicate email in file"] })),
      },
    },
  });

  await writeAudit({
    userId: admin.id,
    action: "user.import.completed",
    entity: "ImportBatch",
    entityId: batch.id,
    after: { rowsTotal: rows.length, rowsOk: createdIds.length, rowsFailed: rows.length - createdIds.length },
  });

  revalidatePath("/users");
  revalidatePath("/users/import");
  return { batchId: batch.id, created: createdIds.length, skipped: rows.length - createdIds.length };
}

const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function rollbackImportBatch(batchId: string) {
  const admin = await requireRole("ADMIN");
  const batch = await db.importBatch.findUnique({ where: { id: batchId }, include: { members: { select: { id: true } } } });
  if (!batch) return { error: "That import batch no longer exists." };
  if (batch.rolledBackAt) return { error: "This batch was already rolled back." };
  if (Date.now() - batch.createdAt.getTime() > ROLLBACK_WINDOW_MS) return { error: "This batch is older than 24 hours and can no longer be rolled back automatically." };

  const memberIds = batch.members.map((m) => m.id);
  await db.$transaction([
    db.user.updateMany({ where: { id: { in: memberIds } }, data: { isActive: false } }),
    db.session.deleteMany({ where: { userId: { in: memberIds } } }),
    db.importBatch.update({ where: { id: batchId }, data: { rolledBackAt: new Date(), rolledBackById: admin.id } }),
  ]);
  await writeAudit({ userId: admin.id, action: "user.import.rolledBack", entity: "ImportBatch", entityId: batchId, after: { deactivated: memberIds.length } });

  revalidatePath("/users");
  revalidatePath("/users/import");
}
