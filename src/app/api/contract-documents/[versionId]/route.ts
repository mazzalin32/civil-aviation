import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getObject } from "@/lib/documents/storage";
import { decryptFile } from "@/lib/documents/encryption";
import { watermarkPdf } from "@/lib/documents/watermark";
import { formatDate } from "@/lib/time";
import { checkMassDownload } from "@/lib/security/activity";

/**
 * Every view/download/print for a contract document streams through here — never a direct
 * storage URL (spec §9, same pattern as /api/documents/[versionId]). Contracts are org-wide
 * readable, same as Matters, so any signed-in user may view/download unless the document is
 * marked highly confidential.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const version = await db.contractDocumentVersion.findUnique({
    where: { id: versionId },
    include: { document: { include: { contract: { select: { organizationId: true } } } } },
  });
  if (!version || version.document.deletedAt) return new NextResponse("Not found", { status: 404 });

  const { document } = version;
  // Never serve another organisation's document, even to a signed-in user elsewhere on the platform.
  if (document.contract.organizationId !== user.organizationId) return new NextResponse("Not found", { status: 404 });

  const action = (request.nextUrl.searchParams.get("action") ?? "view") as "view" | "download" | "print";
  if (document.confidentiality === "HIGHLY_CONFIDENTIAL" && action !== "view" && user.role !== "ADMIN") {
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
    action: `contractDocument.${action}`,
    entity: "ContractDocument",
    entityId: document.id,
    after: { versionId: version.id, name: document.name },
  });
  await db.contractDocumentAccessLog.create({
    data: { documentId: document.id, userId: user.id, action: action.toUpperCase() as "VIEW" | "DOWNLOAD" | "PRINT" },
  });

  // Too many different files in a short time: tell the Admins, and if auto-lock is on, stop here.
  if ((await checkMassDownload(user)).locked) {
    return new NextResponse("Your account has been locked after unusually many downloads. Contact the Head of Legal.", { status: 403 });
  }

  return new NextResponse(new Uint8Array(plaintext), {
    headers: {
      "Content-Type": version.mimeType,
      "Content-Disposition": `${action === "download" ? "attachment" : "inline"}; filename="${encodeURIComponent(document.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
