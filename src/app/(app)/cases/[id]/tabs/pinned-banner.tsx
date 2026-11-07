"use client";

import { Pin, PinOff } from "lucide-react";
import { formatDate } from "@/lib/time";
import { MentionText } from "@/components/app/chat/mention-text";
import type { SerializedChatMessage } from "./discussion-actions";

/** Pinned messages, shown above the thread (FLOWS §10 step 3). */
export function PinnedBanner({
  messages,
  onUnpin,
  canPin,
}: {
  messages: SerializedChatMessage[];
  onUnpin: (messageId: string) => void;
  canPin: boolean;
}) {
  const pinned = messages.filter((m) => m.isPinned && !m.deletedAt);
  if (pinned.length === 0) return null;

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-text-muted uppercase tracking-wide">
        <Pin className="size-3.5" />
        Pinned ({pinned.length})
      </div>
      <div className="grid gap-2">
        {pinned.map((m) => (
          <div key={m.id} className="flex items-start gap-2 rounded-control bg-surface-muted px-3 py-2">
            <Pin className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] whitespace-pre-wrap">
                <MentionText text={m.body} />
              </p>
              <span className="text-[11px] text-text-muted">
                {m.authorName} · {formatDate(new Date(m.createdAt), { day: "numeric", month: "short" })}
              </span>
            </div>
            {canPin && (
              <button
                type="button"
                onClick={() => onUnpin(m.id)}
                className="shrink-0 text-text-muted hover:text-text"
                aria-label="Unpin message"
              >
                <PinOff className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
