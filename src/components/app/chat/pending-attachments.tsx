"use client";

import { Link2, Mic, Paperclip, X } from "lucide-react";
import type { LinkableDocument } from "./attach-document-dialog";
import { formatFileSize } from "./chat-utils";

/** Files and linked case documents queued in the composer, each removable before sending. */
export function PendingAttachments({
  files,
  docs,
  variant,
  onRemoveFile,
  onRemoveDoc,
}: {
  files: File[];
  docs: LinkableDocument[];
  variant: "hub" | "tab";
  onRemoveFile: (index: number) => void;
  onRemoveDoc: (id: string) => void;
}) {
  if (files.length === 0 && docs.length === 0) return null;
  const hub = variant === "hub";

  return (
    <div className={hub ? "mb-2 flex flex-wrap gap-1.5 pb-2 border-b border-border/40" : "mb-2 flex flex-wrap gap-1.5"}>
      {files.map((f, i) => (
        <span
          key={`file-${i}`}
          className={
            hub
              ? "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-muted/50 px-2 py-0.5 text-xs"
              : "inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-[12px]"
          }
        >
          {f.type.startsWith("audio/") ? <Mic className="size-3 text-text-muted" /> : <Paperclip className="size-3 text-text-muted" />}
          <span className="max-w-[140px] truncate">{f.name}</span>
          <span className={hub ? "text-text-muted text-[10px]" : "text-text-muted"}>{formatFileSize(f.size)}</span>
          <button type="button" onClick={() => onRemoveFile(i)} className="text-text-muted hover:text-danger">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {docs.map((d) => (
        <span
          key={`doc-${d.id}`}
          className={
            hub
              ? "inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary-soft px-2 py-0.5 text-xs text-primary"
              : "inline-flex items-center gap-1.5 rounded-control border border-primary bg-primary-soft px-2 py-1 text-[12px]"
          }
        >
          <Link2 className="size-3" />
          <span className={hub ? "max-w-[140px] truncate font-medium" : "max-w-[140px] truncate"}>{d.name}</span>
          <button type="button" onClick={() => onRemoveDoc(d.id)} className={hub ? "text-primary hover:text-danger" : "text-text-muted hover:text-danger"}>
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
