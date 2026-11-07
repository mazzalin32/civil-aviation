"use client";

import { Download, FileText, Link2, Mic } from "lucide-react";
import type { SerializedChatAttachment } from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import type { PreviewFile } from "@/components/app/file-preview-modal";
import { formatFileSize } from "./chat-utils";

/** The preview-modal payload for a chat attachment (served by the permission-checked download route). */
export function previewFileFor(att: SerializedChatAttachment): PreviewFile {
  return {
    name: att.name,
    size: att.size,
    mimeType: att.mimeType,
    viewUrl: `${att.downloadUrl}?action=view`,
    downloadUrl: `${att.downloadUrl}?action=download`,
  };
}

/** A clickable attachment on a message: opens the preview; the arrow downloads. */
export function AttachmentChip({
  att,
  variant,
  onPreview,
}: {
  att: SerializedChatAttachment;
  variant: "hub" | "tab";
  onPreview: (file: PreviewFile) => void;
}) {
  const hub = variant === "hub";
  const icon = att.isLinkedDocument ? (
    <Link2 className={hub ? "size-3.5 text-primary shrink-0" : "size-3.5 text-primary"} />
  ) : att.mimeType.startsWith("audio/") ? (
    <Mic className={hub ? "size-3.5 text-text-muted shrink-0" : "size-3.5 text-text-muted"} />
  ) : (
    <FileText className={hub ? "size-3.5 text-text-muted shrink-0" : "size-3.5 text-text-muted"} />
  );

  return (
    <div
      onClick={() => onPreview(previewFileFor(att))}
      className={
        hub
          ? "group/att inline-flex items-center gap-2 rounded-md border border-border/70 bg-surface px-2.5 py-1 text-xs text-text transition-colors hover:bg-surface-muted shadow-2xs cursor-pointer select-none"
          : "mt-1.5 inline-flex items-center gap-1.5 rounded-control border border-border px-2.5 py-1 text-[12px] text-text hover:bg-surface-muted cursor-pointer transition-colors shadow-2xs group/att"
      }
      title={`Preview ${att.name}`}
    >
      {icon}
      <span
        className={
          hub
            ? "truncate max-w-[200px] font-medium group-hover/att:text-primary transition-colors"
            : "max-w-[180px] truncate group-hover/att:text-primary transition-colors"
        }
      >
        {att.name}
      </span>
      {hub && att.isLinkedDocument && (
        <span className="rounded bg-primary-soft px-1 text-[9px] font-semibold text-primary">Case Doc</span>
      )}
      <span className={hub ? "text-[10px] text-text-muted" : "text-text-muted"}>{formatFileSize(att.size)}</span>
      <a
        href={`${att.downloadUrl}?action=download`}
        download
        onClick={(e) => e.stopPropagation()}
        className={
          hub
            ? "rounded p-0.5 text-text-muted hover:text-text hover:bg-surface-muted/80 transition-colors ml-0.5"
            : "rounded p-0.5 text-text-muted hover:text-text hover:bg-surface-muted transition-colors ml-0.5"
        }
        title="Download file"
      >
        <Download className={hub ? "size-3 shrink-0" : "size-3"} />
      </a>
    </div>
  );
}
