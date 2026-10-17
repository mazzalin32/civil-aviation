"use client";

import { useState, useTransition } from "react";
import { Download, Eye, FileText, History, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { formatDate } from "@/lib/time";
import { deleteContractDocument, restoreContractDocument } from "./documents-actions";
import { UploadContractDocumentDialog } from "./upload-document-dialog";
import { FilePreviewModal, type PreviewFile } from "@/components/app/file-preview-modal";
import { withToast } from "@/components/ui/toast";

export type ContractDocRow = {
  id: string;
  name: string;
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

export function ContractDocumentsSection({
  contractId,
  documents,
  folders,
  isAdmin,
  canMutate,
}: {
  contractId: string;
  documents: ContractDocRow[];
  folders: { id: string; name: string }[];
  isAdmin: boolean;
  canMutate: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const active = documents.filter((d) => !d.deletedAt);
  const deleted = documents.filter((d) => d.deletedAt);
  const grouped = new Map<string, ContractDocRow[]>();
  for (const d of active) grouped.set(d.folderName, [...(grouped.get(d.folderName) ?? []), d]);

  function onDelete(d: ContractDocRow) {
    if (!window.confirm(`Delete "${d.name}"? An Admin can restore it later.`)) return;
    startTransition(async () => {
      await withToast(deleteContractDocument(contractId, d.id), "Document deleted");
    });
  }
  function onRestore(d: ContractDocRow) {
    startTransition(async () => {
      await withToast(restoreContractDocument(contractId, d.id), "Document restored");
    });
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="m-0 text-base font-semibold">Documents</h2>
        <Button type="button" size="sm" className="ml-auto" onClick={() => setUploadOpen(true)}>
          <Plus className="size-3.5" /> Upload
        </Button>
      </div>

      <div className="grid gap-6">
        {active.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">No documents uploaded yet.</p>
        ) : (
          [...grouped.entries()].map(([folderName, docs]) => (
            <div key={folderName}>
              <h3 className="m-0 mb-2 text-[12px] font-semibold text-text-muted uppercase">{folderName}</h3>
              <div className="grid gap-2">
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-card border border-border p-3">
                    <FileText className="size-5 shrink-0 text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {d.currentVersionId ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewFile({
                                name: d.name,
                                size: d.size,
                                viewUrl: `/api/contract-documents/${d.currentVersionId}?action=view`,
                                downloadUrl: `/api/contract-documents/${d.currentVersionId}?action=download`,
                                canDownload: d.confidentiality !== "HIGHLY_CONFIDENTIAL" || isAdmin,
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
                      <div className="flex shrink-0 items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewFile({
                              name: d.name,
                              size: d.size,
                              viewUrl: `/api/contract-documents/${d.currentVersionId}?action=view`,
                              downloadUrl: `/api/contract-documents/${d.currentVersionId}?action=download`,
                              canDownload: d.confidentiality !== "HIGHLY_CONFIDENTIAL" || isAdmin,
                            })
                          }
                          className="text-text-muted hover:text-primary transition-colors cursor-pointer"
                          title="Preview document"
                        >
                          <Eye className="size-4" />
                        </button>
                        {(d.confidentiality !== "HIGHLY_CONFIDENTIAL" || isAdmin) && (
                          <a
                            href={`/api/contract-documents/${d.currentVersionId}?action=download`}
                            download
                            className="text-text-muted hover:text-primary transition-colors"
                            title="Download document"
                          >
                            <Download className="size-4" />
                          </a>
                        )}
                      </div>
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
            <h3 className="m-0 mb-2 text-[12px] font-semibold text-text-muted uppercase">Deleted (Admin only)</h3>
            <div className="grid gap-2">
              {deleted.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-card border border-border p-3 opacity-70">
                  <FileText className="size-5 shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <b className="truncate text-[13px] font-medium">{d.name}</b>
                    <p className="m-0 text-xs text-text-muted">Deleted {d.deletedAt && formatDate(new Date(d.deletedAt))}</p>
                  </div>
                  <RowActionsMenu actions={[{ label: "Restore", icon: RotateCcw, onClick: () => onRestore(d) }]} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <UploadContractDocumentDialog contractId={contractId} folders={folders} open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
