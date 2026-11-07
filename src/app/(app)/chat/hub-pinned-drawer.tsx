"use client";

import { Pin, PinOff, X } from "lucide-react";
import { MentionText } from "@/components/app/chat/mention-text";
import { formatDate } from "@/lib/time";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";

/** The drawer under the header listing the thread's pinned messages. */
export function HubPinnedDrawer({
  pinned,
  canUnpin,
  onUnpin,
  onClose,
}: {
  pinned: SerializedChatMessage[];
  canUnpin: boolean;
  onUnpin: (messageId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-border/60 bg-primary-soft/15 px-5 py-3">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-primary">
        <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <Pin className="size-3" />
          Pinned Updates ({pinned.length})
        </span>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
          <X className="size-3.5" />
        </button>
      </div>
      {pinned.length === 0 ? (
        <p className="m-0 text-xs text-text-muted">No pinned messages. Lead counsel can pin key strategic notes here.</p>
      ) : (
        <div className="grid gap-2 max-h-40 overflow-y-auto pr-1">
          {pinned.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-2 rounded-md bg-surface border border-border/60 p-2 text-xs shadow-2xs"
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 whitespace-pre-wrap text-text">
                  <MentionText text={m.body} variant="chip" />
                </p>
                <span className="mt-0.5 block text-[10px] text-text-muted">
                  {m.authorName} · {formatDate(new Date(m.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              {canUnpin && (
                <button type="button" onClick={() => onUnpin(m.id)} className="text-text-muted hover:text-danger p-0.5" title="Unpin">
                  <PinOff className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
