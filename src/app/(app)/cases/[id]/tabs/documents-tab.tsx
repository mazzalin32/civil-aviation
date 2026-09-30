"use client";

import { useState, useTransition } from "react";
import { Download, Eye, FileText, History, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { formatDate } from "@/lib/time";
import { deleteDocument, restoreDocument, permanentlyDeleteDocument } from "./documents-actions";
import { UploadDocumentDialog } from "./upload-document-dialog";

export type DocRow = {
  id: string;
  name: string;
  folderId: string;
  folderName: string;
  tags: string[];
  confidentiality: "NORMAL" | "CONFIDENTIAL" | "HIGHLY_CONFIDENTIAL";
  currentVersionId: string | null;
  versionCount: number;
  size: number | null;
  uploadedByName: string;
  uploadedAt: string | null;
  deletedAt: string | null;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsTab({
  matterId,
  documents,
  folders,
  events,
  matterConfidentiality,
  isAdmin,
  canUpload,
  canMutate,
}: {
  matterId: string;
  documents: DocRow[];
  folders: { id: string; name: string }[];
  events: { id: string; title: string }[];
  matterConfidentiality: "NORMAL" | "CONFIDENTIAL" | "HIGHLY_CONFIDENTIAL";
  isAdmin: boolean;
  /** Anyone can upload a supporting document, even off the case team (prototype: org-wide). */
  canUpload: boolean;
  /** Deleting requires being on the case team (Lead/Support) or Admin. */
  canMutate: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = documents.filter((d) => !d.deletedAt);
  const deleted = documents.filter((d) => d.deletedAt);
  const grouped = new Map<string, DocRow[]>();
  for (const d of active) grouped.set(d.folderName, [...(grouped.get(d.folderName) ?? []), d]);

  function onDelete(d: DocRow) {
    if (!window.confirm(`Delete "${d.name}"? An Admin can restore it later.`)) return;
    startTransition(async () => {
      await deleteDocument(matterId, d.id);
    });
  }
  function onRestore(d: DocRow) {
    startTransition(async () => {
      await restoreDocument(matterId, d.id);
    });
  }
  function onPurge(d: DocRow) {
    if (!window.confirm(`Permanently delete "${d.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await permanentlyDeleteDocument(matterId, d.id);
    });
  }

  return (
    <div className="grid gap-6">
      {canUpload && (
        <Button type="button" variant="primary" className="justify-self-start" onClick={() => setUploadOpen(true)}>
          <Plus className="size-4" /> Upload document
        </Button>
      )}

      {active.length === 0 ? (
        <p className="m-0 text-[13px] text-text-muted">No documents uploaded yet.</p>
      ) : (
        [...grouped.entries()].map(([folderName, docs]) => (
          <div key={folderName}>
            <h3 className="m-0 mb-2 text-[13px] font-semibold text-text-muted uppercase">{folderName}</h3>
            <div className="grid gap-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-card border border-border p-3">
                  <FileText className="size-5 shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="truncate text-[13px] font-medium">{d.name}</b>
                      {d.confidentiality !== "NORMAL" && (
                        <Badge tone="neutral">
                          <Lock className="size-3" /> {d.confidentiality === "HIGHLY_CONFIDENTIAL" ? "Highly confidential" : "Confidential"}
                        </Badge>
                      )}
                      {d.versionCount > 1 && (
                        <Badge tone="info">
                          <History className="size-3" /> v{d.versionCount}
                        </Badge>
                      )}
                      {d.tags.map((t) => (
                        <Badge key={t} tone="neutral">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <p className="m-0 text-xs text-text-muted">
                      {d.size !== null && `${formatBytes(d.size)} · `}
                      {d.uploadedByName}
                      {d.uploadedAt && ` · ${formatDate(new Date(d.uploadedAt))}`}
                    </p>
                  </div>
                  {d.currentVersionId && (
                    <>
                      <a href={`/api/documents/${d.currentVersionId}?action=view`} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text" title="View">
                        <Eye className="size-4" />
                      </a>
                      {d.confidentiality !== "HIGHLY_CONFIDENTIAL" && (
                        <a href={`/api/documents/${d.currentVersionId}?action=download`} className="text-text-muted hover:text-text" title="Download">
                          <Download className="size-4" />
                        </a>
                      )}
                    </>
                  )}
                  {canMutate && <RowActionsMenu actions={[{ label: "Delete", icon: Trash2, danger: true, disabled: pending, onClick: () => onDelete(d) }]} />}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {isAdmin && deleted.length > 0 && (
        <div>
          <h3 className="m-0 mb-2 text-[13px] font-semibold text-text-muted uppercase">Deleted (Admin only)</h3>
          <div className="grid gap-2">
            {deleted.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-card border border-border p-3 opacity-70">
                <FileText className="size-5 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <b className="truncate text-[13px] font-medium">{d.name}</b>
                  <p className="m-0 text-xs text-text-muted">Deleted {d.deletedAt && formatDate(new Date(d.deletedAt))}</p>
                </div>
                <RowActionsMenu
                  actions={[
                    { label: "Restore", icon: RotateCcw, onClick: () => onRestore(d) },
                    { label: "Delete permanently", icon: Trash2, danger: true, onClick: () => onPurge(d) },
                  ]}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <UploadDocumentDialog
        matterId={matterId}
        folders={folders}
        events={events}
        defaultConfidentiality={matterConfidentiality}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  );
}
