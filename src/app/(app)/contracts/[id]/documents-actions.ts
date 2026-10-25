"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireContractAccess, requireContractEdit } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { encryptFile, sha256Hex } from "@/lib/documents/encryption";
import { putObject } from "@/lib/documents/storage";
import { scanBuffer } from "@/lib/documents/virus-scan";
import { detectFileType } from "@/lib/documents/file-signatures";
import { uploadContractDocumentSchema, MAX_UPLOAD_BYTES } from "@/lib/validation/document";

type ActionResult = { error?: string } | void;

export async function uploadContractDocument(formData: FormData): Promise<ActionResult> {
  const parsed = uploadContractDocumentSchema.safeParse({
    contractId: formData.get("contractId"),
    folderId: formData.get("folderId"),
    confidentiality: formData.get("confidentiality"),
    tags: formData.get("tags"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const { contractId, folderId, confidentiality, tags } = parsed.data;
  const user = await requireContractAccess(contractId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That file is larger than the 25MB limit." };

  const buffer = Buffer.from(await file.arrayBuffer());

  const detected = detectFileType(buffer);
  if (!detected) return { error: "Unsupported file type — PDF, Word/Excel/PowerPoint, PNG, JPEG or plain text only." };

  const scan = await scanBuffer(buffer);
  if (scan.status === "INFECTED") {
    await writeAudit({ userId: user.id, action: "contractDocument.upload.infected", entity: "Contract", entityId: contractId, after: { name: file.name, detail: scan.detail } });
    return { error: "This file was flagged by the virus scanner and was not uploaded." };
  }
  if (scan.status === "ERROR") {
    return { error: `Couldn't scan this file (${scan.detail}) — upload was not accepted.` };
  }

  const sha256 = sha256Hex(buffer);
  const encrypted = encryptFile(buffer);

  const existing = await db.contractDocument.findFirst({
    where: { contractId, folderId, name: file.name, deletedAt: null },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  const document = await db.$transaction(async (tx) => {
    const doc =
      existing ??
      (await tx.contractDocument.create({
        data: { contractId, folderId, name: file.name, tags, confidentiality, uploadedById: user.id },
      }));

    const nextVersion = (existing?.versions[0]?.version ?? 0) + 1;
    const storageKey = `contracts/${doc.id}/v${nextVersion}`;
    await putObject(storageKey, encrypted.ciphertext);

    const version = await tx.contractDocumentVersion.create({
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

    await tx.contractDocument.update({ where: { id: doc.id }, data: { currentVersionId: version.id } });
    await tx.contract.update({ where: { id: contractId }, data: { lastActivityAt: new Date() } });
    await writeAudit(
      { userId: user.id, action: existing ? "contractDocument.version.add" : "contractDocument.upload", entity: "ContractDocument", entityId: doc.id, after: { name: file.name, version: nextVersion } },
      tx,
    );

    return doc;
  });

  const team = await db.contractAssignment.findMany({ where: { contractId, removedAt: null, userId: { not: user.id } }, select: { userId: true } });
  for (const { userId } of team) {
    await notify({
      userId,
      type: "DOCUMENT_UPLOADED",
      contractId,
      payload: { name: file.name },
      subject: "Contract document uploaded",
      message: `${user.name} uploaded "${file.name}".`,
      url: `/contracts/${contractId}`,
    });
  }

  revalidatePath(`/contracts/${contractId}`);
  return document ? undefined : { error: "Upload failed." };
}

export async function deleteContractDocument(contractId: string, documentId: string): Promise<ActionResult> {
  const user = await requireContractEdit(contractId);
  const document = await db.contractDocument.findUnique({ where: { id: documentId }, select: { contractId: true } });
  if (!document || document.contractId !== contractId) return { error: "That document no longer exists." };
  await db.contractDocument.update({ where: { id: documentId }, data: { deletedAt: new Date(), deletedById: user.id } });
  await writeAudit({ userId: user.id, action: "contractDocument.delete", entity: "ContractDocument", entityId: documentId });
  revalidatePath(`/contracts/${contractId}`);
}

export async function restoreContractDocument(contractId: string, documentId: string): Promise<ActionResult> {
  const user = await requireContractAccess(contractId);
  if (user.role !== "ADMIN") return { error: "Only an Admin can restore a deleted document." };
  const document = await db.contractDocument.findUnique({ where: { id: documentId }, select: { contractId: true } });
  if (!document || document.contractId !== contractId) return { error: "That document no longer exists." };
  await db.contractDocument.update({ where: { id: documentId }, data: { deletedAt: null, deletedById: null } });
  await writeAudit({ userId: user.id, action: "contractDocument.restore", entity: "ContractDocument", entityId: documentId });
  revalidatePath(`/contracts/${contractId}`);
}
