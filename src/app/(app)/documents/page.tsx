import Link from "next/link";
import { FolderOpen, Download, Eye, FileText, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/time";
import { DocumentsToolbar } from "./documents-toolbar";

export const metadata = { title: "Documents" };

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Org-wide document library — a read-through view across every matter's Documents tab,
 *  plus its own upload button (you pick the case in the dialog since this page isn't
 *  scoped to one) so this doesn't 404 or dead-end for a pitch demo. */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  await requireRole();
  const { q, sort: sortParam } = await searchParams;
  const query = q?.trim();
  const sort: "latest" | "az" = sortParam === "az" ? "az" : "latest";

  const [documents, matters, folders] = await Promise.all([
    db.document.findMany({
      where: {
        deletedAt: null,
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
    db.matter.findMany({ where: { status: { in: ["OPEN", "ON_HOLD"] } }, select: { id: true, reference: true, title: true }, orderBy: { reference: "asc" } }),
    db.documentFolder.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { order: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Documents" description="Every document across every matter." />

      <DocumentsToolbar query={query} sort={sort} matters={matters} folders={folders} />

      {documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={query ? "No documents match that search" : "No documents yet"}
          description={query ? "Try a different name, case title or reference." : "Upload one above, or from any case's Documents tab."}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid divide-y divide-border">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                <FileText className="size-5 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="truncate text-[13px] font-medium">{d.name}</b>
                    {d.confidentiality !== "NORMAL" && (
                      <Badge tone="neutral">
                        <Lock className="size-3" /> {d.confidentiality === "HIGHLY_CONFIDENTIAL" ? "Highly confidential" : "Confidential"}
                      </Badge>
                    )}
                  </div>
                  <p className="m-0 text-xs text-text-muted">
                    <Link href={`/cases/${d.matter.id}?tab=documents`} className="text-primary hover:underline">
                      {d.matter.reference}
                    </Link>
                    {" · "}
                    {d.matter.title} · {d.folder.name}
                    {d.currentVersion?.size != null && ` · ${formatBytes(d.currentVersion.size)}`}
                    {" · "}
                    {d.uploadedBy.name}
                    {d.currentVersion?.uploadedAt && ` · ${formatDate(d.currentVersion.uploadedAt)}`}
                  </p>
                </div>
                {d.currentVersionId && (
                  <div className="flex shrink-0 items-center gap-3">
                    <a href={`/api/documents/${d.currentVersionId}?action=view`} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text" title="View">
                      <Eye className="size-4" />
                    </a>
                    {d.confidentiality !== "HIGHLY_CONFIDENTIAL" && (
                      <a href={`/api/documents/${d.currentVersionId}?action=download`} className="text-text-muted hover:text-text" title="Download">
                        <Download className="size-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
