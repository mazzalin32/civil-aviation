import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

export type AuditEntry = {
  userId: string | null;
  action: string; // e.g. "user.create", "setting.update"
  entity: string; // e.g. "User", "Matter"
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
};

type Client = Pick<typeof db, "auditLog">;

/** Every mutation writes one row. Pass the transaction client so the log commits with the change. */
export function writeAudit(entry: AuditEntry, client: Client = db) {
  return client.auditLog.create({ data: entry });
}
