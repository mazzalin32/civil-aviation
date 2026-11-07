"use client";

import { Pin, PinOff, Trash2 } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { AttachmentChip } from "@/components/app/chat/attachment-chip";
import { MentionText } from "@/components/app/chat/mention-text";
import type { PreviewFile } from "@/components/app/file-preview-modal";
import { checkCanDeleteMessage } from "@/lib/chat/rules";
import { formatDate } from "@/lib/time";
import type { SerializedChatMessage } from "./discussion-actions";

/** One message in the case Discussion tab: a bubble (yours on the right) with hover actions. */
export function TabMessageBubble({
  message: m,
  mine,
  canPin,
  readOnly,
  isAdmin,
  onPin,
  onDelete,
  onPreview,
}: {
  message: SerializedChatMessage;
  mine: boolean;
  canPin: boolean;
  readOnly: boolean;
  isAdmin: boolean;
  onPin: (messageId: string, isPinned: boolean) => void;
  onDelete: (messageId: string) => void;
  onPreview: (file: PreviewFile) => void;
}) {
  const canDelete = !readOnly && checkCanDeleteMessage({ isAuthor: mine, isAdmin, createdAt: m.createdAt, matterStatus: "OPEN" }).ok;

  return (
    <li id={`msg-${m.id}`} className={`group flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar name={m.authorName} seed={m.authorId} />
      <div className="max-w-[min(560px,80%)]">
        <div
          className={`rounded-card px-3.5 py-2.5 ${mine ? "bg-primary-soft" : "bg-surface-muted"} ${
            m.isPinned ? "ring-1 ring-primary/30" : ""
          }`}
        >
          <div className="mb-1 flex flex-wrap items-baseline gap-2">
            <b className="text-[13px] font-semibold">{mine ? "You" : m.authorName}</b>
            <time className="text-[11px] text-text-muted">
              {formatDate(new Date(m.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </time>
            {m.isPinned && <Pin className="size-3 text-primary" />}
          </div>
          {m.body && (
            <p className="m-0 text-[13.5px] whitespace-pre-wrap">
              <MentionText text={m.body} />
            </p>
          )}
          {m.attachments.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {m.attachments.map((att) => (
                <AttachmentChip key={att.id} att={att} variant="tab" onPreview={onPreview} />
              ))}
            </div>
          )}
        </div>
        {/* Message actions — visible on hover */}
        <div className="mt-0.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canPin && !readOnly && (
            <button
              type="button"
              onClick={() => onPin(m.id, !m.isPinned)}
              className="rounded-control p-1 text-text-muted hover:bg-surface-muted hover:text-text"
              title={m.isPinned ? "Unpin" : "Pin"}
            >
              {m.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(m.id)}
              className="rounded-control p-1 text-text-muted hover:bg-danger-soft hover:text-danger"
              title="Delete message"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
