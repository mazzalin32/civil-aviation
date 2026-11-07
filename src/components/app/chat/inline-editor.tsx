"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MESSAGE_EDIT_WINDOW_MINUTES } from "@/lib/chat/rules";

/**
 * Edit-in-place for your own message. Enter saves, Shift+Enter adds a line, Esc cancels. `onSave`
 * resolves true when the server accepted the change (the editor then closes itself via `onDone`).
 */
export function InlineEditor({
  initialText,
  onSave,
  onDone,
}: {
  initialText: string;
  onSave: (text: string) => Promise<boolean>;
  onDone: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving || !text.trim() || text === initialText) return;
    setSaving(true);
    const ok = await onSave(text);
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <div className="grid gap-1.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onDone();
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
        }}
        autoFocus
        rows={Math.min(8, Math.max(2, text.split("\n").length))}
        aria-label="Edit message"
        className="w-full resize-none rounded-md border border-primary/50 bg-surface p-2 text-[13.5px] text-text focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        <Button type="button" variant="primary" size="sm" onClick={save} disabled={saving || !text.trim() || text === initialText}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <span className="ml-auto hidden sm:inline">Enter to save · Esc to cancel · editable for {MESSAGE_EDIT_WINDOW_MINUTES} min</span>
      </div>
    </div>
  );
}
