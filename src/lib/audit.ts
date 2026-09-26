import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

export type AuditEntry = {
  userId: string | null;
  action: string; // e.g. "user.create", "setting.update"
  entity: string; // e.g. "User", "Matter"
  entityId?: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ip?: string;
  userAgent?: string;
};

type Client = Pick<typeof db, "auditLog">;

/** Every mutation writes one row. Pass the transaction client so the log commits with the change. */
export function writeAudit(entry: AuditEntry, client: Client = db) {
  // Prisma wants its own JsonNull sentinel for an explicit null, not the JS value —
  // omitting the field is equivalent (both leave the column NULL), so drop it instead.
  return client.auditLog.create({ data: { ...entry, before: entry.before ?? undefined, after: entry.after ?? undefined } });
}
