"use client";

import { useRef } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { MAX_UPLOAD_BYTES } from "@/lib/validation/document";
import { StepHeader } from "./shared";

const sizeLabel = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function DocumentsStep({
  files,
  onFiles,
  folders,
  folderId,
  onFolder,
}: {
  files: File[];
  onFiles: (files: File[]) => void;
  folders: { id: string; name: string }[];
  folderId: string;
  onFolder: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const tooBig = files.filter((f) => f.size > MAX_UPLOAD_BYTES);

  function add(list: FileList | null) {
    if (!list) return;
    onFiles([...files, ...Array.from(list)]);
    if (input.current) input.current.value = "";
  }

  return (
    <>
      <StepHeader title="Supporting documents" />
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
        className="grid place-items-center gap-2 rounded-[12px] border border-dashed border-border bg-surface-muted px-6 py-10 text-center"
      >
        <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
          <Upload className="size-5" />
        </span>
        <p className="m-0 text-[13.5px] font-medium">Upload case documents</p>
        <p className="m-0 text-xs text-text-muted">PDF, Office, image or text — up to 25 MB each</p>
        <input ref={input} type="file" multiple hidden onChange={(e) => add(e.target.files)} />
        <Button type="button" size="sm" onClick={() => input.current?.click()}>
          Choose files
        </Button>
      </div>

      {folders.length > 0 && (
        <div className="mt-4 max-w-sm">
          <Field label="Save into folder" htmlFor="d-folder">
            <Select id="d-folder" value={folderId} onChange={(e) => onFolder(e.target.value)}>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {files.length === 0 ? (
        <p className="m-0 mt-2 rounded-[12px] border border-border px-4 py-3 text-[13px] text-text-muted">No documents attached yet.</p>
      ) : (
        <ul className="m-0 mt-2 grid list-none gap-2 p-0">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-[12px] border border-border px-4 py-2.5 text-[13px]">
              <FileText className="size-4 shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className={f.size > MAX_UPLOAD_BYTES ? "text-danger" : "text-text-muted"}>{f.size > MAX_UPLOAD_BYTES ? "Too large" : sizeLabel(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onFiles(files.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-danger">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {tooBig.length > 0 && <p className="m-0 mt-2 text-xs text-danger">Remove files larger than 25 MB before continuing.</p>}
    </>
  );
}
