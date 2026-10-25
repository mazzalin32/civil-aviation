import Link from "next/link";
import { FolderOpen, Download, Eye, FileText, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { orgId } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/time";
import { DocumentsToolbar } from "./documents-toolbar";
import { DocumentsList } from "./documents-list";

export const metadata = { title: "Documents" };

/** Org-wide document library — a read-through view across every matter's Documents tab,
 *  plus its own upload button (you pick the case in the dialog since this page isn't
 *  scoped to one) so this doesn't 404 or dead-end for a pitch demo. */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const user = await requireRole();
  const { q, sort: sortParam } = await searchParams;
  const query = q?.trim();
  const sort: "latest" | "az" = sortParam === "az" ? "az" : "latest";

  const [documents, matters, folders] = await Promise.all([
    db.document.findMany({
      where: {
        deletedAt: null,
        matter: { deletedAt: null, organizationId: orgId(user.organizationId) },
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { matter: { title: { contains: query, mode: "insensitive" } } },
                { matter: { reference: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        matter: { select: { id: true, reference: true, title: true } },
        folder: { select: { name: true } },
        uploadedBy: { select: { name: true } },
        currentVersion: { select: { size: true, uploadedAt: true } },
      },
      orderBy: sort === "az" ? { name: "asc" } : { createdAt: "desc" },
      take: 200,
    }),
    db.matter.findMany({ where: { deletedAt: null, status: { in: ["OPEN", "ON_HOLD"] }, organizationId: orgId(user.organizationId) }, select: { id: true, reference: true, title: true }, orderBy: { reference: "asc" } }),
    db.documentFolder.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { order: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Documents" />

      <DocumentsToolbar query={query} sort={sort} matters={matters} folders={folders} />

      {documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={query ? "No documents match that search" : "No documents yet"}
          description={query ? "Try a different name, case title or reference." : "Upload one above, or from any case's Documents tab."}
        />
      ) : (
        <DocumentsList documents={documents} userRole={user.role} />
      )}
    </>
  );
}
