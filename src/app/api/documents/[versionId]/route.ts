import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessMatter } from "@/lib/authz";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getObject } from "@/lib/documents/storage";
import { decryptFile } from "@/lib/documents/encryption";
import { watermarkPdf } from "@/lib/documents/watermark";
import { formatDate } from "@/lib/time";

/**
 * Every view/download/print streams through here — never a direct storage URL (spec §9).
 * Permission and confidentiality are re-checked on every request; PDFs get a live watermark
 * (name + date/time of the person viewing right now, not who uploaded it).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const version = await db.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: { include: { matter: { select: { id: true, confidentiality: true } } } } },
  });
  if (!version || version.document.deletedAt) return new NextResponse("Not found", { status: 404 });

  const { document } = version;
  const allowed = await canAccessMatter(user.id, user.role, document.matterId);
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const action = (request.nextUrl.searchParams.get("action") ?? "view") as "view" | "download" | "print";
  const isHighlyConfidential = document.confidentiality === "HIGHLY_CONFIDENTIAL" || document.matter.confidentiality === "HIGHLY_CONFIDENTIAL";
  if (isHighlyConfidential && action !== "view" && user.role !== "ADMIN") {
    return new NextResponse("This document is highly confidential and can only be viewed, not downloaded or printed.", { status: 403 });
  }

  const ciphertext = await getObject(version.storageKey);
  let plaintext = decryptFile(ciphertext, version.encryptedDataKey, version.iv, version.authTag);

  if (version.mimeType === "application/pdf") {
    const label = `${user.name} · ${formatDate(new Date(), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
    plaintext = await watermarkPdf(plaintext, label);
  }

  await writeAudit({
    userId: user.id,
    action: `document.${action}`,
    entity: "Document",
    entityId: document.id,
    after: { versionId: version.id, name: document.name },
  });
  await db.documentAccessLog.create({
    data: { documentId: document.id, userId: user.id, action: action.toUpperCase() as "VIEW" | "DOWNLOAD" | "PRINT" },
  });

  return new NextResponse(new Uint8Array(plaintext), {
    headers: {
      "Content-Type": version.mimeType,
      "Content-Disposition": `${action === "download" ? "attachment" : "inline"}; filename="${encodeURIComponent(document.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
