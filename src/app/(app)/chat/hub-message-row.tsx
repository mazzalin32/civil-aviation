"use client";

import { useState } from "react";
import { Pencil, Pin, PinOff, Reply, Trash2 } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { AttachmentChip } from "@/components/app/chat/attachment-chip";
import { InlineEditor } from "@/components/app/chat/inline-editor";
import { MentionText } from "@/components/app/chat/mention-text";
import { ReplyQuote } from "@/components/app/chat/reply";
import { serializeMentions } from "@/components/app/chat/chat-utils";
import type { PreviewFile } from "@/components/app/file-preview-modal";
import { checkCanDeleteMessage, checkCanEditMessage } from "@/lib/chat/rules";
import { mentionsToHandles } from "@/lib/mentions";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";

/** One message in the Chat hub: avatar, author, time, body, attachments and a hover toolbar. */
export function HubMessageRow({
  message: m,
  isMine,
  assignmentRole,
  highlighted,
  canPin,
  readOnly,
  isAdmin,
  onPin,
  onDelete,
  onReply,
  onEdit,
  onPreview,
}: {
  message: SerializedChatMessage;
  isMine: boolean;
  /** LEAD / SUPPORT badge next to the author, when they're on the case team. */
  assignmentRole: string | null;
  highlighted: boolean;
  canPin: boolean;
  readOnly: boolean;
  isAdmin: boolean;
  onPin: (messageId: string, isPinned: boolean) => void;
  onDelete: (messageId: string) => void;
  onReply: (message: SerializedChatMessage) => void;
  onEdit: (messageId: string, body: string) => Promise<boolean>;
  onPreview: (file: PreviewFile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const canDelete = !readOnly && checkCanDeleteMessage({ isAuthor: isMine, isAdmin, createdAt: m.createdAt, matterStatus: "OPEN" }).ok;
  const canEdit = !readOnly && checkCanEditMessage({ isAuthor: isMine, createdAt: m.createdAt, matterStatus: "OPEN" }).ok;

  return (
    <div
      id={`msg-${m.id}`}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg p-2 transition-colors duration-700 hover:bg-surface-muted/30",
        highlighted && "bg-primary-soft ring-1 ring-primary/40",
      )}
    >
      <Avatar name={m.authorName} seed={m.authorId} className="size-8 text-xs shrink-0 mt-0.5 rounded-full" />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text">
            {m.authorName}
            {isMine && <span className="ml-1 text-[11px] font-normal text-text-muted">(You)</span>}
          </span>
          {assignmentRole && (
            <span className="rounded bg-surface-muted px-1.5 py-0.2 text-[9px] uppercase font-bold text-text-muted tracking-wider border border-border/40">
              {assignmentRole}
            </span>
          )}
          <time className="text-[10px] text-text-muted">{formatDate(new Date(m.createdAt), { hour: "numeric", minute: "2-digit" })}</time>
          {m.editedAt && (
            <span className="text-[10px] text-text-muted" title={`Edited ${formatDate(new Date(m.editedAt), { hour: "numeric", minute: "2-digit" })}`}>
              (edited)
            </span>
          )}
          {m.isPinned && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
              <Pin className="size-2.5" /> Pinned
            </span>
          )}
        </div>

        {m.replyTo && <ReplyQuote replyTo={m.replyTo} />}

        {editing ? (
          <InlineEditor
            initialText={mentionsToHandles(m.body)}
            onSave={(text) => onEdit(m.id, serializeMentions(text, m.mentions.map((x) => ({ id: x.userId, name: x.userName }))))}
            onDone={() => setEditing(false)}
          />
        ) : (
          m.body && (
            <p className="m-0 text-[13.5px] leading-relaxed text-text whitespace-pre-wrap">
              <MentionText text={m.body} variant="chip" />
            </p>
          )
        )}

        {m.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {m.attachments.map((att) => (
              <AttachmentChip key={att.id} att={att} variant="hub" onPreview={onPreview} />
            ))}
          </div>
        )}
      </div>

      {/* Floating hover toolbar */}
      {!editing && (
        <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-border/60 bg-surface px-1 py-0.5 shadow-xs opacity-0 transition-opacity group-hover:opacity-100">
          {!readOnly && (
            <button
              type="button"
              onClick={() => onReply(m)}
              className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text"
              title="Reply"
            >
              <Reply className="size-3.5" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text"
              title="Edit message"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {canPin && !readOnly && (
            <button
              type="button"
              onClick={() => onPin(m.id, !m.isPinned)}
              className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text"
              title={m.isPinned ? "Unpin message" : "Pin message"}
            >
              {m.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(m.id)}
              className="rounded p-1 text-text-muted hover:bg-danger-soft hover:text-danger"
              title="Delete message"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
