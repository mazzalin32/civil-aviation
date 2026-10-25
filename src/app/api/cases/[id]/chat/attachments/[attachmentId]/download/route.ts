import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessMatterChat } from "@/lib/authz";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getObject } from "@/lib/documents/storage";
import { decryptFile } from "@/lib/documents/encryption";
import { watermarkPdf } from "@/lib/documents/watermark";
import { formatDate } from "@/lib/time";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id: matterId, attachmentId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const matter = await db.matter.findUnique({ where: { id: matterId }, select: { organizationId: true } });
  if (!matter || matter.organizationId !== user.organizationId) return new NextResponse("Not found", { status: 404 });

  const allowed = await canAccessMatterChat(user.id, user.role, matterId);
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const attachment = await db.matterMessageAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      message: { select: { matterId: true, deletedAt: true } },
      document: {
        include: {
          currentVersion: true,
          matter: { select: { id: true, confidentiality: true } },
        },
      },
    },
  });

  if (!attachment || attachment.message.matterId !== matterId || attachment.message.deletedAt) {
    return new NextResponse("Attachment not found", { status: 404 });
  }

  const action = (request.nextUrl.searchParams.get("action") ?? "download") as "view" | "download";

  // Case 1: Linked case document
  if (attachment.document && attachment.document.currentVersion) {
    const { document } = attachment;
    const version = document.currentVersion!;
    if (document.deletedAt) return new NextResponse("Document not found", { status: 404 });

    const isHighlyConfidential =
      document.confidentiality === "HIGHLY_CONFIDENTIAL" ||
      document.matter.confidentiality === "HIGHLY_CONFIDENTIAL";
    if (isHighlyConfidential && action !== "view" && user.role !== "ADMIN") {
      return new NextResponse("This document is highly confidential and can only be viewed, not downloaded.", { status: 403 });
    }

    const ciphertext = await getObject(version.storageKey);
    let plaintext = decryptFile(ciphertext, version.encryptedDataKey, version.iv, version.authTag);

    if (version.mimeType === "application/pdf") {
      const label = `${user.name} · ${formatDate(new Date(), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
      plaintext = await watermarkPdf(plaintext, label);
    }

    await writeAudit({
      userId: user.id,
      action: `chat.attachment.document.${action}`,
      entity: "MatterMessageAttachment",
      entityId: attachment.id,
      after: { documentId: document.id, name: document.name, matterId },
    });

    return new NextResponse(new Uint8Array(plaintext), {
      headers: {
        "Content-Type": version.mimeType,
        "Content-Disposition": `${action === "download" ? "attachment" : "inline"}; filename="${encodeURIComponent(document.name)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Case 2: Direct uploaded chat attachment
  if (!attachment.storageKey || !attachment.encryptedDataKey || !attachment.iv || !attachment.authTag) {
    return new NextResponse("Attachment data unavailable", { status: 404 });
  }

  const ciphertext = await getObject(attachment.storageKey);
  let plaintext = decryptFile(ciphertext, attachment.encryptedDataKey, attachment.iv, attachment.authTag);

  if (attachment.mimeType === "application/pdf") {
    const label = `${user.name} · ${formatDate(new Date(), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
    plaintext = await watermarkPdf(plaintext, label);
  }

  await writeAudit({
    userId: user.id,
    action: `chat.attachment.${action}`,
    entity: "MatterMessageAttachment",
    entityId: attachment.id,
    after: { name: attachment.name, matterId },
  });

  return new NextResponse(new Uint8Array(plaintext), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${action === "download" ? "attachment" : "inline"}; filename="${encodeURIComponent(attachment.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
