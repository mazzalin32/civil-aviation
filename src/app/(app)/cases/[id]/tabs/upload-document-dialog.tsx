"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { cn } from "@/lib/utils";
import { uploadDocument } from "./documents-actions";

export function UploadDocumentDialog({
  matterId,
  folders,
  events,
  defaultConfidentiality,
  open,
  onClose,
}: {
  matterId: string;
  folders: { id: string; name: string }[];
  events: { id: string; title: string }[];
  defaultConfidentiality: "NORMAL" | "CONFIDENTIAL" | "HIGHLY_CONFIDENTIAL";
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await uploadDocument(formData);
      if (result?.error) return setError(result.error);
      setFileName(undefined);
      onClose();
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      setFileName(file.name);
    }
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Upload document">
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="matterId" value={matterId} />
        {error && <p className="m-0 text-xs text-danger">{error}</p>}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "grid cursor-pointer place-items-center gap-2 rounded-control border-2 border-dashed p-8 text-center",
            dragOver ? "border-primary bg-primary-soft" : "border-border",
          )}
        >
          <UploadCloud className="size-6 text-text-muted" />
          <p className="m-0 text-[13px]">{fileName ?? "Drag a file here, or click to choose"}</p>
          <p className="m-0 text-xs text-text-muted">PDF, Word, Excel, PowerPoint, PNG, JPEG or text — up to 25MB</p>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            required
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name)}
          />
        </div>

        <Field label="Folder" htmlFor="doc-folder">
          <Select id="doc-folder" name="folderId" required>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Confidentiality" htmlFor="doc-conf" hint="Inherits the case's level by default">
          <Select id="doc-conf" name="confidentiality" defaultValue={defaultConfidentiality}>
            <option value="NORMAL">Normal</option>
            <option value="CONFIDENTIAL">Confidential</option>
            <option value="HIGHLY_CONFIDENTIAL">Highly confidential</option>
          </Select>
        </Field>

        <Field label="Tags" htmlFor="doc-tags" hint="Comma-separated, optional">
          <Input id="doc-tags" name="tags" placeholder="e.g. draft, urgent" />
        </Field>

        {events.length > 0 && (
          <Field label="Link to timeline event" htmlFor="doc-event" hint="Optional — marks this as evidence for that event">
            <Select id="doc-event" name="linkedEventId" defaultValue="">
              <option value="">Not linked</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Uploading…" : "Upload"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}
