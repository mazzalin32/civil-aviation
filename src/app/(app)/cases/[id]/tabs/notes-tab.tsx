"use client";

import { useState, useTransition } from "react";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { formatDate } from "@/lib/time";
import { addNote, deleteNote, updateNote } from "../actions";
import { withToast } from "@/components/ui/toast";

export type NoteRow = { id: string; body: string; isPrivate: boolean; authorId: string; authorName: string; updatedAt: string };

export function NotesTab({
  matterId,
  notes,
  currentUserId,
  canMutate,
}: {
  matterId: string;
  notes: NoteRow[];
  currentUserId: string;
  canMutate: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submitNew(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(addNote({ matterId, body: formData.get("body"), isPrivate: formData.get("isPrivate") === "on" }), "Note added");
      if (result?.error) return setError(result.error);
    });
  }

  function submitEdit(note: NoteRow, formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(updateNote({ matterId, id: note.id, body: formData.get("body"), isPrivate: formData.get("isPrivate") === "on" }), "Note updated");
      if (result?.error) return setError(result.error);
      setEditingId(null);
    });
  }

  function onDelete(note: NoteRow) {
    if (!window.confirm("Delete this note?")) return;
    startTransition(async () => {
      await withToast(deleteNote(matterId, note.id), "Note deleted");
    });
  }

  return (
    <div className="grid gap-4">
      {error && <p className="m-0 text-[13px] text-danger">{error}</p>}

      {canMutate && (
      <form action={submitNew} className="grid gap-2 rounded-card border border-border p-4">
        <textarea
          name="body"
          rows={3}
          required
          placeholder="Write a note…"
          className="w-full rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-text-muted">
            <input type="checkbox" name="isPrivate" className="size-4 accent-primary" />
            Private (only you and Admin can see it)
          </label>
          <Button type="submit" variant="primary" size="sm" disabled={pending} className="ml-auto">
            Add note
          </Button>
        </div>
      </form>
      )}

      {notes.length === 0 ? (
        <p className="m-0 text-[13px] text-text-muted">No notes yet.</p>
      ) : (
        <div className="grid gap-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-card border border-border p-4">
              {editingId === n.id ? (
                <form action={(fd) => submitEdit(n, fd)} className="grid gap-2">
                  <textarea
                    name="body"
                    rows={3}
                    defaultValue={n.body}
                    className="w-full rounded-control border border-border bg-surface p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  />
                  <label className="flex items-center gap-2 text-[13px] text-text-muted">
                    <input type="checkbox" name="isPrivate" defaultChecked={n.isPrivate} className="size-4 accent-primary" />
                    Private
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary" size="sm" disabled={pending}>
                      Save
                    </Button>
                    <Button type="button" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mb-1.5 flex items-center gap-2">
                    <b className="text-[13px] font-semibold">{n.authorName}</b>
                    {n.isPrivate && (
                      <Badge tone="neutral">
                        <Lock className="size-3" /> Private
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-text-muted">{formatDate(new Date(n.updatedAt))}</span>
                    {canMutate && n.authorId === currentUserId && (
                      <RowActionsMenu
                        actions={[
                          { label: "Edit", icon: Pencil, onClick: () => setEditingId(n.id) },
                          { label: "Delete", icon: Trash2, danger: true, disabled: pending, onClick: () => onDelete(n) },
                        ]}
                      />
                    )}
                  </div>
                  <p className="m-0 text-[13px] whitespace-pre-wrap">{n.body}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
