"use client";

import { useEffect, useRef } from "react";
import { Link2, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceRecorder } from "@/components/app/voice-recorder";
import { MentionPopover } from "@/components/app/chat/mention-popover";
import { PendingAttachments } from "@/components/app/chat/pending-attachments";
import { ReplyBar } from "@/components/app/chat/reply";
import type { MessageComposer } from "@/components/app/chat/use-message-composer";

/** The Chat hub's composer: one card with the text box and an action bar (attach, link, record, @, send). */
export function HubComposer({
  composer,
  placeholder,
  allowAttachments = true,
}: {
  composer: MessageComposer;
  placeholder: string;
  /** The department channel has no files or voice notes (yet). */
  allowAttachments?: boolean;
}) {
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
    <div className="border-t border-border/60 p-3.5 bg-surface shrink-0">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          composer.send(textareaRef.current);
        }}
        className="relative"
      >
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

        <div className="rounded-xl border border-border/70 bg-surface p-2.5 shadow-2xs focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          {composer.replyingTo && <ReplyBar replyingTo={composer.replyingTo} onCancel={composer.cancelReply} className="mb-2" />}
          <PendingAttachments
            files={composer.directFiles}
            docs={composer.linkedDocs}
            variant="hub"
            onRemoveFile={composer.removeDirectFile}
            onRemoveDoc={composer.removeLinkedDoc}
          />

          <textarea
            ref={textareaRef}
            name="body"
            rows={2}
            onChange={composer.handleTextareaChange}
            onKeyDown={composer.handleKeyDown}
            placeholder={placeholder}
            className="w-full resize-none border-0 bg-transparent p-1 text-[13px] text-text placeholder:text-text-muted/60 focus:outline-none min-h-[44px] max-h-36"
          />

          <div className="flex items-center justify-between pt-1.5 border-t border-border/30 mt-1">
            <div className="flex items-center gap-0.5 text-text-muted">
              {allowAttachments && (
                <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid size-7 place-items-center rounded-md hover:bg-surface-muted hover:text-text transition-colors"
                title="Upload file"
              >
                <Paperclip className="size-3.5" />
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
                className="grid size-7 place-items-center rounded-md hover:bg-surface-muted hover:text-text transition-colors"
                title="Link case document"
              >
                <Link2 className="size-3.5" />
              </button>

              <VoiceRecorder onRecorded={composer.addFile} buttonClassName="grid size-7 place-items-center rounded-md" iconClassName="size-3.5" />
                </>
              )}

              <button
                type="button"
                onClick={() => mention.start(textareaRef.current)}
                className="grid size-7 place-items-center rounded-md hover:bg-surface-muted hover:text-text transition-colors text-xs font-semibold"
                title="Mention counsel"
              >
                @
              </button>

              <span className="text-[10px] text-text-muted/50 ml-2 hidden sm:inline">Shift+Enter for newline</span>
            </div>

            <Button type="submit" variant="primary" disabled={composer.pending} className="h-7 px-3 text-xs font-medium rounded-md">
              <Send className="size-3 mr-1" />
              <span>{composer.pending ? "Sending…" : "Send"}</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
