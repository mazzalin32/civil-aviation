"use client";

import { useEffect, useRef } from "react";
import { Link2, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceRecorder } from "@/components/app/voice-recorder";
import { MentionPopover } from "@/components/app/chat/mention-popover";
import { PendingAttachments } from "@/components/app/chat/pending-attachments";
import { ReplyBar } from "@/components/app/chat/reply";
import type { MessageComposer } from "@/components/app/chat/use-message-composer";

/** The Discussion tab's composer: attach, link a case document, record, write, send. */
export function TabComposer({ composer }: { composer: MessageComposer }) {
  const { mention } = composer;
  // The composer owns its DOM refs; the shared hook only ever receives the elements.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clicking Reply on a message puts the cursor straight in the box.
  const replyId = composer.replyingTo?.id;
  useEffect(() => {
    if (replyId) textareaRef.current?.focus();
  }, [replyId]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        composer.send(textareaRef.current);
      }}
      className="relative"
    >
      {composer.replyingTo && <ReplyBar replyingTo={composer.replyingTo} onCancel={composer.cancelReply} className="mb-2" />}
      <PendingAttachments
        files={composer.directFiles}
        docs={composer.linkedDocs}
        variant="tab"
        onRemoveFile={composer.removeDirectFile}
        onRemoveDoc={composer.removeLinkedDoc}
      />

      {mention.show && (
        <MentionPopover
          users={mention.users}
          query={mention.query}
          onSelect={(user) => mention.select(user, textareaRef.current)}
          onClose={mention.close}
          anchorRect={mention.anchor}
          selectedIndex={mention.selectedIndex}
          onHoverIndex={mention.setSelectedIndex}
        />
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="grid size-11 shrink-0 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
          aria-label="Upload a file"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={composer.handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
        />

        <button
          type="button"
          onClick={() => composer.setShowAttachDialog(true)}
          className="grid size-11 shrink-0 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
          aria-label="Attach from case documents"
          title="Attach from case documents"
        >
          <Link2 className="size-4" />
        </button>

        <VoiceRecorder onRecorded={composer.addFile} />

        <textarea
          ref={textareaRef}
          name="body"
          rows={2}
          placeholder="Write a message. Use @ to mention someone…"
          onChange={composer.handleTextareaChange}
          onKeyDown={composer.handleKeyDown}
          className="min-h-[44px] flex-1 rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        />

        <Button type="submit" variant="primary" disabled={composer.pending}>
          <Send className="size-4" />
          {composer.pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
