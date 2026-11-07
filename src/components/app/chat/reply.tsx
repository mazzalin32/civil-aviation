"use client";

import { CornerUpLeft, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { flashMessage } from "./chat-utils";

type Quoted = { id: string; authorName: string; snippet: string; deleted?: boolean };

/** Shown above the text box while you are replying: who and what, with a way to cancel. */
export function ReplyBar({ replyingTo, onCancel, className }: { replyingTo: Quoted; onCancel: () => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-md border-l-2 border-primary bg-primary-soft/50 px-2.5 py-1.5 text-xs", className)}>
      <CornerUpLeft className="size-3.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-text">Replying to {replyingTo.authorName}</span>
        <p className="m-0 truncate text-text-muted">{replyingTo.snippet || "Attachment"}</p>
      </div>
      <button type="button" onClick={onCancel} className="shrink-0 text-text-muted hover:text-text" aria-label="Cancel reply">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** The quoted original above a reply; clicking it jumps to that message (if it is already loaded). */
export function ReplyQuote({ replyTo, className }: { replyTo: Quoted; className?: string }) {
  function jump() {
    if (replyTo.deleted) return;
    if (!flashMessage(replyTo.id)) toast.info("That message is earlier in the thread — load earlier messages to see it.");
  }

  return (
    <button
      type="button"
      onClick={jump}
      className={cn(
        "mb-1 flex w-full max-w-full items-start gap-1.5 rounded-md border-l-2 border-primary/60 bg-surface-muted/70 px-2 py-1 text-left text-xs hover:bg-surface-muted",
        className,
      )}
    >
      <CornerUpLeft className="mt-0.5 size-3 shrink-0 text-text-muted" />
      <span className="min-w-0">
        <span className="font-semibold text-text">{replyTo.authorName}</span>
        <span className="block truncate text-text-muted">
          {replyTo.deleted ? <em>Original message deleted</em> : replyTo.snippet || "Attachment"}
        </span>
      </span>
    </button>
  );
}
