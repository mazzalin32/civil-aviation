"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMatterAccess } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { encryptFile, sha256Hex } from "@/lib/documents/encryption";
import { putObject, deleteObject } from "@/lib/documents/storage";
import { scanBuffer } from "@/lib/documents/virus-scan";
import { detectFileType } from "@/lib/documents/file-signatures";
import { uploadDocumentSchema, MAX_UPLOAD_BYTES } from "@/lib/validation/document";

type ActionResult = { error?: string } | void;

export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const parsed = uploadDocumentSchema.safeParse({
    matterId: formData.get("matterId"),
    folderId: formData.get("folderId"),
    confidentiality: formData.get("confidentiality"),
    tags: formData.get("tags"),
    linkedEventId: formData.get("linkedEventId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { matterId, folderId, confidentiality, tags, linkedEventId } = parsed.data;
  const user = await requireMatterAccess(matterId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That file is larger than the 25MB limit." };

  const buffer = Buffer.from(await file.arrayBuffer());

  const detected = detectFileType(buffer);
  if (!detected) return { error: "Unsupported file type — PDF, Word/Excel/PowerPoint, PNG, JPEG or plain text only." };

  const scan = await scanBuffer(buffer);
  if (scan.status === "INFECTED") {
    await writeAudit({ userId: user.id, action: "document.upload.infected", entity: "Matter", entityId: matterId, after: { name: file.name, detail: scan.detail } });
    return { error: "This file was flagged by the virus scanner and was not uploaded." };
  }
  if (scan.status === "ERROR") {
    return { error: `Couldn't scan this file (${scan.detail}) — upload was not accepted.` };
  }

  const sha256 = sha256Hex(buffer);
  const encrypted = encryptFile(buffer);

  const existing = await db.document.findFirst({
    where: { matterId, folderId, name: file.name, deletedAt: null },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  const document = await db.$transaction(async (tx) => {
    const doc =
      existing ??
      (await tx.document.create({
        data: { matterId, folderId, name: file.name, tags, confidentiality, uploadedById: user.id },
      }));

    const nextVersion = (existing?.versions[0]?.version ?? 0) + 1;
    const storageKey = `${doc.id}/v${nextVersion}`;
    await putObject(storageKey, encrypted.ciphertext);

    const version = await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        version: nextVersion,
        storageKey,
        sha256,
        mimeType: detected.mimeType,
        size: buffer.length,
        encryptedDataKey: encrypted.encryptedDataKey,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        scanStatus: "CLEAN",
        scanDetail: scan.detail ?? null,
        uploadedById: user.id,
      },
    });

    await tx.document.update({ where: { id: doc.id }, data: { currentVersionId: version.id } });

    if (linkedEventId) {
      await tx.eventDocument.upsert({
        where: { eventId_documentId: { eventId: linkedEventId, documentId: doc.id } },
        update: {},
        create: { eventId: linkedEventId, documentId: doc.id },
      });
    }

    await tx.matter.update({ where: { id: matterId }, data: { lastActivityAt: new Date() } });
    await writeAudit(
      { userId: user.id, action: existing ? "document.version.add" : "document.upload", entity: "Document", entityId: doc.id, after: { name: file.name, version: nextVersion } },
      tx,
    );

    return doc;
  });

  const team = await db.matterAssignment.findMany({ where: { matterId, removedAt: null, userId: { not: user.id } }, select: { userId: true } });
  for (const { userId } of team) {
    await notify({
      userId,
      type: "DOCUMENT_UPLOADED",
      matterId,
      payload: { name: file.name },
      subject: "Document uploaded",
      message: `${user.name} uploaded "${file.name}".`,
      url: `/cases/${matterId}?tab=documents`,
    });
  }

  revalidatePath(`/cases/${matterId}`);
  return document ? undefined : { error: "Upload failed." };
}

export async function deleteDocument(matterId: string, documentId: string): Promise<ActionResult> {
  const user = await requireMatterAccess(matterId);
  const linked = await db.eventDocument.findFirst({ where: { documentId } });
  if (linked && user.role !== "ADMIN") return { error: "Only an Admin can delete a document linked to a timeline event as evidence." };

  await db.document.update({ where: { id: documentId }, data: { deletedAt: new Date(), deletedById: user.id } });
  await writeAudit({ userId: user.id, action: "document.delete", entity: "Document", entityId: documentId });
  revalidatePath(`/cases/${matterId}`);
}

export async function restoreDocument(matterId: string, documentId: string): Promise<ActionResult> {
  const user = await requireMatterAccess(matterId);
  if (user.role !== "ADMIN") return { error: "Only an Admin can restore a deleted document." };

  await db.document.update({ where: { id: documentId }, data: { deletedAt: null, deletedById: null } });
  await writeAudit({ userId: user.id, action: "document.restore", entity: "Document", entityId: documentId });
  revalidatePath(`/cases/${matterId}`);
}

export async function permanentlyDeleteDocument(matterId: string, documentId: string): Promise<ActionResult> {
  const user = await requireMatterAccess(matterId);
  if (user.role !== "ADMIN") return { error: "Only an Admin can permanently delete a document." };

  const versions = await db.documentVersion.findMany({ where: { documentId }, select: { storageKey: true } });
  await db.$transaction(async (tx) => {
    await tx.document.update({ where: { id: documentId }, data: { currentVersionId: null } });
    await tx.documentVersion.deleteMany({ where: { documentId } });
    await tx.document.delete({ where: { id: documentId } });
  });
  for (const v of versions) await deleteObject(v.storageKey);
  await writeAudit({ userId: user.id, action: "document.purge", entity: "Document", entityId: documentId });
  revalidatePath(`/cases/${matterId}`);
}
