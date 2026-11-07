"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileImage,
  FileArchive,
  File,
  X,
  Loader2,
  FileCode,
  Mic,
} from "lucide-react";

export type PreviewFile = {
  name: string;
  size?: number | null;
  mimeType?: string | null;
  viewUrl: string;
  downloadUrl?: string;
  canDownload?: boolean;
};

function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function getFileCategory(name: string, mimeType?: string | null): "pdf" | "image" | "audio" | "text" | "office" | "other" {
  const ext = getFileExtension(name);
  const mime = mimeType?.toLowerCase() || "";

  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (mime.startsWith("audio/") || ["webm", "ogg", "mp3", "wav", "m4a"].includes(ext)) return "audio";
  if (mime.startsWith("text/") || ["txt", "csv", "json", "md", "log", "xml", "html"].includes(ext)) return "text";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  return "other";
}

function getFileIcon(name: string, mimeType?: string | null) {
  const category = getFileCategory(name, mimeType);
  const ext = getFileExtension(name);

  if (category === "pdf") return <FileText className="size-4 text-danger" />;
  if (category === "image") return <FileImage className="size-4 text-primary" />;
  if (category === "audio") return <Mic className="size-4 text-primary" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="size-4 text-success" />;
  if (category === "text") return <FileCode className="size-4 text-text-muted" />;
  if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) return <FileArchive className="size-4 text-warning" />;
  return <File className="size-4 text-text-muted" />;
}

export function FilePreviewModal({
  file,
  onClose,
}: {
  file: PreviewFile | null;
  onClose: () => void;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!file) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, onClose]);

  // Lock background scroll when open
  useEffect(() => {
    if (file) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [file]);

  // Opening a different file resets the preview state. Done during render (React's "adjust state
  // when a prop changes" pattern) instead of inside the fetch effect below.
  const [prevFile, setPrevFile] = useState(file);
  if (prevFile !== file) {
    setPrevFile(file);
    setTextContent(null);
    setLoadError(null);
    setIsLoadingText(!!file && getFileCategory(file.name, file.mimeType) === "text");
  }

  // Fetch text file content if category is text
  useEffect(() => {
    if (!file || getFileCategory(file.name, file.mimeType) !== "text") return;
    let cancelled = false;

    fetch(file.viewUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load text preview");
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setTextContent(text);
        setIsLoadingText(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Could not render text file.");
        setIsLoadingText(false);
      });

    return () => {
      cancelled = true; // a slow response for a previous file must not overwrite the current one
    };
  }, [file]);

  if (!file) return null;

  const category = getFileCategory(file.name, file.mimeType);
  const ext = getFileExtension(file.name).toUpperCase();
  const downloadHref = file.downloadUrl || `${file.viewUrl}${file.viewUrl.includes("?") ? "&" : "?"}action=download`;
  const canDownload = file.canDownload !== false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-5xl h-[88vh] rounded-xl border border-border bg-surface shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-13 items-center justify-between border-b border-border/80 px-4 sm:px-5 bg-surface shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 mr-4">
            <div className="grid size-7.5 place-items-center rounded-md bg-surface-muted shrink-0">
              {getFileIcon(file.name, file.mimeType)}
            </div>
            <div className="min-w-0">
              <h2 className="m-0 truncate text-xs sm:text-[13px] font-semibold text-text" title={file.name}>
                {file.name}
              </h2>
              {file.size ? (
                <span className="text-[10px] text-text-muted">
                  {formatBytes(file.size)} {ext && `· ${ext}`}
                </span>
              ) : ext ? (
                <span className="text-[10px] text-text-muted">{ext}</span>
              ) : null}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={file.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2.5 py-1 text-xs text-text hover:bg-surface-muted transition-colors"
              title="Open in browser tab"
            >
              <ExternalLink className="size-3 text-text-muted" />
              <span className="hidden sm:inline">Open in Tab</span>
            </a>

            {canDownload && (
              <a
                href={downloadHref}
                download
                className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2.5 py-1 text-xs text-text hover:bg-surface-muted transition-colors"
                title="Download file"
              >
                <Download className="size-3 text-text-muted" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="grid size-7.5 place-items-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text transition-colors ml-1"
              aria-label="Close preview"
              title="Close (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-hidden bg-neutral-900/5 relative flex items-center justify-center">
          {category === "pdf" && (
            <iframe
              src={file.viewUrl}
              className="w-full h-full border-0 bg-neutral-100"
              title={file.name}
            />
          )}

          {category === "image" && (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              {/* `unoptimized`: this is a private case file served by the permission-checked download route.
                  Next's image optimizer would fetch it server-side without the user's session and cache resized
                  copies on disk, bypassing the permission check and access log — so it must not be used here.
                  width/height 0 + auto sizing keeps the file's natural size, capped to the window (as before). */}
              <Image
                src={file.viewUrl}
                alt={file.name}
                width={0}
                height={0}
                sizes="100vw"
                unoptimized
                className="h-auto w-auto max-h-full max-w-full object-contain rounded-md shadow-md"
              />
            </div>
          )}

          {category === "audio" && (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
                <Mic className="size-7" />
              </div>
              <audio src={file.viewUrl} controls autoPlay className="w-full max-w-sm" />
            </div>
          )}

          {category === "text" && (
            <div className="w-full h-full p-4 overflow-auto bg-surface">
              {isLoadingText ? (
                <div className="flex h-full items-center justify-center text-xs text-text-muted gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Loading text content...</span>
                </div>
              ) : loadError ? (
                <div className="flex h-full items-center justify-center text-xs text-danger">
                  {loadError}
                </div>
              ) : (
                <pre className="font-mono text-xs text-text whitespace-pre-wrap leading-relaxed select-text p-2">
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {(category === "office" || category === "other") && (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-surface rounded-xl border border-border shadow-xs">
              <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-surface-muted text-primary shadow-2xs">
                {category === "office" ? (
                  <FileSpreadsheet className="size-7" />
                ) : (
                  <FileText className="size-7" />
                )}
              </div>
              <h3 className="m-0 text-sm font-semibold text-text">{file.name}</h3>
              <p className="mt-1 text-xs text-text-muted">
                {file.size ? `${formatBytes(file.size)} · ` : ""}
                {ext ? `${ext} document` : "Document"}
              </p>
              <p className="mt-3 text-xs text-text-muted/80 leading-normal">
                This file format cannot be rendered directly inside the web browser. Download it to view in your desktop application.
              </p>
              {canDownload && (
                <a
                  href={downloadHref}
                  download
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:bg-primary-hover shadow-xs transition-colors"
                >
                  <Download className="size-3.5" />
                  <span>Download Document</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
