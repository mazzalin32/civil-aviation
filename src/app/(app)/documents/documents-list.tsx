"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Eye, FileText, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/time";
import { FilePreviewModal, type PreviewFile } from "@/components/app/file-preview-modal";

export type DocumentListItem = {
  id: string;
  name: string;
  confidentiality: "NORMAL" | "CONFIDENTIAL" | "HIGHLY_CONFIDENTIAL";
  currentVersionId: string | null;
  matter: { id: string; reference: string; title: string };
  folder: { name: string };
  uploadedBy: { name: string };
  currentVersion: { size: number; uploadedAt: Date } | null;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsList({
  documents,
  userRole,
}: {
  documents: DocumentListItem[];
  userRole?: string;
}) {
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const isAdmin = userRole === "ADMIN";

  return (
    <>
      <Card className="overflow-hidden">
        <div className="grid divide-y divide-border">
          {documents.map((d) => {
            const canDownload = d.confidentiality !== "HIGHLY_CONFIDENTIAL" || isAdmin;

            return (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-muted/30 transition-colors">
                <FileText className="size-5 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {d.currentVersionId ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewFile({
                            name: d.name,
                            size: d.currentVersion?.size,
                            viewUrl: `/api/documents/${d.currentVersionId}?action=view`,
                            downloadUrl: `/api/documents/${d.currentVersionId}?action=download`,
                            canDownload,
                          })
                        }
                        className="truncate text-left text-[13px] font-medium text-text hover:text-primary hover:underline transition-colors"
                        title={`Preview ${d.name}`}
                      >
                        {d.name}
                      </button>
                    ) : (
                      <b className="truncate text-[13px] font-medium">{d.name}</b>
                    )}
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
                  <div className="flex shrink-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewFile({
                          name: d.name,
                          size: d.currentVersion?.size,
                          viewUrl: `/api/documents/${d.currentVersionId}?action=view`,
                          downloadUrl: `/api/documents/${d.currentVersionId}?action=download`,
                          canDownload,
                        })
                      }
                      className="text-text-muted hover:text-primary transition-colors cursor-pointer"
                      title="Preview document"
                    >
                      <Eye className="size-4" />
                    </button>
                    {canDownload && (
                      <a
                        href={`/api/documents/${d.currentVersionId}?action=download`}
                        download
                        className="text-text-muted hover:text-primary transition-colors"
                        title="Download document"
                      >
                        <Download className="size-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* In-app File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </>
  );
}
