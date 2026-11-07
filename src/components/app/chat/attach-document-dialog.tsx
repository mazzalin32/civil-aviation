"use client";

import { useState } from "react";
import { FileText, Link2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LinkableDocument = {
  id: string;
  name: string;
  folderName: string;
  size: number | null;
};

/**
 * Dialog that lets a user browse and select existing case documents to link
 * into a chat message as attachments — avoids duplicate uploads for files
 * already properly filed in the case's Documents tab.
 */
export function AttachDocumentDialog({
  documents,
  alreadyLinked,
  onLink,
  onClose,
}: {
  documents: LinkableDocument[];
  alreadyLinked: string[];
  onLink: (docIds: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = documents.filter(
    (d) =>
      !alreadyLinked.includes(d.id) &&
      (d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.folderName.toLowerCase().includes(search.toLowerCase())),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    onLink([...selected]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-card border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="m-0 text-[15px] font-semibold">Attach from Case Documents</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-control border border-border bg-surface-muted px-3 py-2">
            <Search className="size-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="flex-1 border-0 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
            />
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto px-5 py-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-text-muted">No matching documents found.</p>
          ) : (
            <ul className="m-0 grid list-none gap-1 p-0">
              {filtered.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => toggle(doc.id)}
                    className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-[13px] ${
                      selected.has(doc.id)
                        ? "border border-primary bg-primary-soft"
                        : "border border-transparent hover:bg-surface-muted"
                    }`}
                  >
                    <FileText className="size-4 shrink-0 text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{doc.name}</span>
                      <span className="text-[11px] text-text-muted">{doc.folderName}</span>
                    </div>
                    {selected.has(doc.id) && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-on-primary">
                        Selected
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-[12px] text-text-muted">
            {selected.size > 0 ? `${selected.size} document${selected.size > 1 ? "s" : ""} selected` : "Select documents to attach"}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={selected.size === 0}>
              <Link2 className="size-4" />
              Attach {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
