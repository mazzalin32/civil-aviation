"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Download,
  ExternalLink,
  FileText,
  Link2,
  Paperclip,
  Pin,
  PinOff,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/time";
import {
  postCaseMessage,
  togglePinCaseMessage,
  deleteCaseMessage,
  type SerializedChatMessage,
  type SerializedChatAttachment,
} from "./discussion-actions";
import { MentionPopover, type MentionUser } from "./mention-popover";
import { AttachDocumentDialog, type LinkableDocument } from "./attach-document-dialog";
import { FilePreviewModal, type PreviewFile } from "@/components/app/file-preview-modal";
import { toast, withToast } from "@/components/ui/toast";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type { SerializedChatMessage };

// ------------------------------------------------------------------
// SSE Hook
// ------------------------------------------------------------------

function useCaseChatStream(
  matterId: string,
  onMessage: (msg: SerializedChatMessage) => void,
  onPinChange: (data: { messageId: string; isPinned: boolean; pinnedAt: string | null; pinnedById: string | null; pinnedByName: string | null }) => void,
  onDelete: (data: { messageId: string }) => void,
) {
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let retryMs = 1000;

    function connect() {
      eventSource = new EventSource(`/api/cases/${matterId}/chat/stream`);

      eventSource.addEventListener("message.created", (e) => {
        try {
          onMessage(JSON.parse(e.data));
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener("message.pinned", (e) => {
        try {
          onPinChange(JSON.parse(e.data));
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener("message.deleted", (e) => {
        try {
          onDelete(JSON.parse(e.data));
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener("connected", () => {
        retryMs = 1000; // reset backoff on successful connect
      });

      eventSource.onerror = () => {
        eventSource?.close();
        reconnectTimeout = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30_000);
      };
    }

    connect();
    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [matterId, onMessage, onPinChange, onDelete]);
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractMentionTokens(text: string): string[] {
  const re = /@\[([^\]]+)\]\(user:([^)]+)\)/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) ids.push(m[2]);
  return ids;
}

/** Renders @[Name](user:id) tokens as styled spans */
function renderBody(text: string) {
  const parts = text.split(/(@\[[^\]]+\]\(user:[^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/@\[([^\]]+)\]\(user:[^)]+\)/);
    if (match) {
      return (
        <span key={i} className="font-medium text-primary">
          @{match[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ------------------------------------------------------------------
// Attachment Badge
// ------------------------------------------------------------------

function AttachmentBadge({
  att,
  matterId,
  onPreview,
}: {
  att: SerializedChatAttachment;
  matterId: string;
  onPreview: (att: SerializedChatAttachment) => void;
}) {
  const icon = att.isLinkedDocument ? <Link2 className="size-3.5 text-primary" /> : <FileText className="size-3.5 text-text-muted" />;
  return (
    <div
      onClick={() => onPreview(att)}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-control border border-border px-2.5 py-1 text-[12px] text-text hover:bg-surface-muted cursor-pointer transition-colors shadow-2xs group/att"
      title={`Preview ${att.name}`}
    >
      {icon}
      <span className="max-w-[180px] truncate group-hover/att:text-primary transition-colors">{att.name}</span>
      <span className="text-text-muted">{formatFileSize(att.size)}</span>
      <a
        href={`/api/cases/${matterId}/chat/attachments/${att.id}/download?action=download`}
        download
        onClick={(e) => e.stopPropagation()}
        className="rounded p-0.5 text-text-muted hover:text-text hover:bg-surface-muted transition-colors ml-0.5"
        title="Download file"
      >
        <Download className="size-3" />
      </a>
    </div>
  );
}

// ------------------------------------------------------------------
// Pinned Messages Banner
// ------------------------------------------------------------------

function PinnedBanner({
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
              <p className="m-0 text-[13px] whitespace-pre-wrap">{renderBody(m.body)}</p>
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

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export function DiscussionTab({
  matterId,
  currentUserId,
  messages: initialMessages,
  team,
  allLawyers,
  caseDocuments,
  canPin,
}: {
  matterId: string;
  currentUserId: string;
  messages: SerializedChatMessage[];
  team: { id: string; name: string; role: string }[];
  allLawyers: { id: string; name: string }[];
  caseDocuments: LinkableDocument[];
  canPin: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [messages, setMessages] = useState(initialMessages);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Composer state
  const [directFiles, setDirectFiles] = useState<File[]>([]);
  const [linkedDocIds, setLinkedDocIds] = useState<string[]>([]);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [showAttachDialog, setShowAttachDialog] = useState(false);

  // @mention
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionAnchor, setMentionAnchor] = useState<{ top: number; left: number } | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [trackedMentions, setTrackedMentions] = useState<{ id: string; name: string }[]>([]);

  // Preview file modal
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Prepare mention users list
  const mentionUsers: MentionUser[] = allLawyers.map((l) => ({
    id: l.id,
    name: l.name,
    isTeamMember: team.some((t) => t.id === l.id),
  }));

  const filteredMentions = mentionUsers.filter((u) =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );
  const sortedMentions = [...filteredMentions].sort((a, b) => {
    if (a.isTeamMember && !b.isTeamMember) return -1;
    if (!a.isTeamMember && b.isTeamMember) return 1;
    return a.name.localeCompare(b.name);
  });

  useEffect(() => {
    setMentionSelectedIndex(0);
  }, [mentionQuery]);

  // SSE callbacks (wrapped in useCallback to avoid re-subscribing)
  const handleNewMessage = useCallback((msg: SerializedChatMessage) => {
    setMessages((prev) => {
      // Deduplicate (our own post arrives via both the action return and SSE)
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handlePinChange = useCallback(
    (data: { messageId: string; isPinned: boolean; pinnedAt: string | null; pinnedById: string | null; pinnedByName: string | null }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, isPinned: data.isPinned, pinnedAt: data.pinnedAt, pinnedById: data.pinnedById, pinnedByName: data.pinnedByName }
            : m,
        ),
      );
    },
    [],
  );

  const handleDelete = useCallback((data: { messageId: string }) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === data.messageId ? { ...m, deletedAt: new Date().toISOString() } : m,
      ),
    );
  }, []);

  useCaseChatStream(matterId, handleNewMessage, handlePinChange, handleDelete);

  // --- Textarea @mention detection ---
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart ?? val.length;
    const textUpToCursor = val.slice(0, cursorPos);
    const atMatch = textUpToCursor.match(/@([a-zA-Z0-9_\s]*)$/);

    if (atMatch && atMatch[1].length <= 30) {
      setMentionQuery(atMatch[1]);
      setShowMentionPopover(true);
      const atIndex = textUpToCursor.lastIndexOf("@");
      const lineBeforeAt = textUpToCursor.slice(0, atIndex).split("\n").pop() || "";
      const leftOffset = Math.max(8, Math.min(lineBeforeAt.length * 7.5 + 8, 260));
      setMentionAnchor({ top: 0, left: leftOffset });
    } else {
      setShowMentionPopover(false);
    }
  }

  function handleMentionSelect(user: MentionUser) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const val = textarea.value;
    const cursorPos = textarea.selectionStart ?? val.length;
    const before = val.slice(0, cursorPos);
    const after = val.slice(cursorPos);
    const atIndex = before.lastIndexOf("@");

    if (atIndex !== -1) {
      const cleanToken = `@${user.name} `;
      const replaced = before.slice(0, atIndex) + cleanToken;
      textarea.value = replaced + after;
      const newPos = atIndex + cleanToken.length;
      textarea.setSelectionRange(newPos, newPos);

      setTrackedMentions((prev) =>
        prev.some((m) => m.id === user.id) ? prev : [...prev, { id: user.id, name: user.name }]
      );
    }

    setShowMentionPopover(false);
    textarea.focus();
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentionPopover && sortedMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev + 1) % sortedMentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev - 1 + sortedMentions.length) % sortedMentions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (sortedMentions[mentionSelectedIndex]) {
          handleMentionSelect(sortedMentions[mentionSelectedIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionPopover(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // --- File handling ---
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setDirectFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  function removeDirectFile(index: number) {
    setDirectFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function removeLinkedDoc(docId: string) {
    setLinkedDocIds((prev) => prev.filter((id) => id !== docId));
  }

  // --- Submit ---
  function send() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const rawBody = textarea.value;
    if (!rawBody.trim() && directFiles.length === 0 && linkedDocIds.length === 0) return;

    // Convert clean "@Name" to serialized "@[Name](user:id)" for storage
    let serializedBody = rawBody;
    const finalMentionIds: string[] = [];

    for (const mention of trackedMentions) {
      const cleanToken = `@${mention.name}`;
      if (serializedBody.includes(cleanToken)) {
        serializedBody = serializedBody.split(cleanToken).join(`@[${mention.name}](user:${mention.id})`);
        if (!finalMentionIds.includes(mention.id)) {
          finalMentionIds.push(mention.id);
        }
      }
    }

    const manualTokens = extractMentionTokens(serializedBody);
    for (const id of manualTokens) {
      if (!finalMentionIds.includes(id)) {
        finalMentionIds.push(id);
      }
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("matterId", matterId);
      fd.append("body", serializedBody);
      fd.append("attachedDocumentIds", JSON.stringify(linkedDocIds));
      fd.append("mentionedUserIds", JSON.stringify(finalMentionIds));

      for (const file of directFiles) {
        fd.append("files", file);
      }

      const result = await withToast(postCaseMessage(fd), null);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Optimistic add (SSE will deduplicate)
      if (result.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.data!.id)) return prev;
          return [...prev, result.data!];
        });
      }

      textarea.value = "";
      setDirectFiles([]);
      setLinkedDocIds([]);
      setTrackedMentions([]);
      formRef.current?.reset();
    });
  }

  // --- Pin/Unpin ---
  function handlePin(messageId: string, isPinned: boolean) {
    startTransition(async () => {
      const result = await withToast(togglePinCaseMessage({ matterId, messageId, isPinned }), "Pin updated");
      if (result.error) toast.error(result.error);
    });
  }

  // --- Delete ---
  function handleDelete2(messageId: string) {
    if (!window.confirm("Delete this message? It will be hidden from the thread.")) return;
    startTransition(async () => {
      const result = await withToast(deleteCaseMessage({ matterId, messageId }), "Message deleted");
      if (result.error) toast.error(result.error);
    });
  }

  // --- Search filtering ---
  const visibleMessages = messages.filter((m) => {
    if (m.deletedAt) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.body.toLowerCase().includes(q) ||
      m.authorName.toLowerCase().includes(q) ||
      m.attachments.some((a) => a.name.toLowerCase().includes(q))
    );
  });

  const searchMatchCount = searchQuery ? visibleMessages.length : 0;

  // Linked doc names for preview chips
  const linkedDocs = linkedDocIds
    .map((id) => caseDocuments.find((d) => d.id === id))
    .filter(Boolean) as LinkableDocument[];

  return (
    <div className="grid gap-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowSearch((v) => !v)}>
          <Search className="size-4" />
          {showSearch ? "Close search" : "Search messages"}
        </Button>
        <Link
          href={`/chat?caseId=${matterId}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-muted"
        >
          <ExternalLink className="size-3.5 text-text-muted" />
          <span>Open in Case Chat Hub</span>
        </Link>
      </div>
      {showSearch && (
          <div className="flex flex-1 items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5">
            <Search className="size-3.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter messages, people, or files…"
              className="flex-1 border-0 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
              autoFocus
            />
            {searchQuery && (
              <span className="text-[11px] text-text-muted">
                {searchMatchCount} match{searchMatchCount !== 1 ? "es" : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setShowSearch(false);
              }}
              className="text-text-muted hover:text-text"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

      {/* Pinned messages banner */}
      <PinnedBanner
        messages={messages}
        onUnpin={(id) => handlePin(id, false)}
        canPin={canPin}
      />

      {/* Message list */}
      <div className="grid gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
        {visibleMessages.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">
            {searchQuery
              ? "No messages match your search."
              : "No messages yet — start the thread for this case."}
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {visibleMessages.map((m) => {
              const mine = m.authorId === currentUserId;
              return (
                <li key={m.id} id={`msg-${m.id}`} className={`group flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
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
                          {formatDate(new Date(m.createdAt), {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                        {m.isPinned && <Pin className="size-3 text-primary" />}
                      </div>
                      {m.body && (
                        <p className="m-0 text-[13.5px] whitespace-pre-wrap">{renderBody(m.body)}</p>
                      )}
                      {m.attachments.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {m.attachments.map((att) => (
                            <AttachmentBadge
                              key={att.id}
                              att={att}
                              matterId={matterId}
                              onPreview={(a) =>
                                setPreviewFile({
                                  name: a.name,
                                  size: a.size,
                                  mimeType: a.mimeType,
                                  viewUrl: `/api/cases/${matterId}/chat/attachments/${a.id}/download?action=view`,
                                  downloadUrl: `/api/cases/${matterId}/chat/attachments/${a.id}/download?action=download`,
                                })
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Message actions — visible on hover */}
                    <div className="mt-0.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {canPin && (
                        <button
                          type="button"
                          onClick={() => handlePin(m.id, !m.isPinned)}
                          className="rounded-control p-1 text-text-muted hover:bg-surface-muted hover:text-text"
                          title={m.isPinned ? "Unpin" : "Pin"}
                        >
                          {m.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                        </button>
                      )}
                      {(mine || canPin) && (
                        <button
                          type="button"
                          onClick={() => handleDelete2(m.id)}
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
            })}
          </ul>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="relative"
      >
        {/* Preview: pending files and linked docs */}
        {(directFiles.length > 0 || linkedDocs.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {directFiles.map((f, i) => (
              <span
                key={`file-${i}`}
                className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-[12px]"
              >
                <Paperclip className="size-3 text-text-muted" />
                <span className="max-w-[140px] truncate">{f.name}</span>
                <span className="text-text-muted">{formatFileSize(f.size)}</span>
                <button type="button" onClick={() => removeDirectFile(i)} className="text-text-muted hover:text-danger">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {linkedDocs.map((d) => (
              <span
                key={`doc-${d.id}`}
                className="inline-flex items-center gap-1.5 rounded-control border border-primary bg-primary-soft px-2 py-1 text-[12px]"
              >
                <Link2 className="size-3 text-primary" />
                <span className="max-w-[140px] truncate">{d.name}</span>
                <button type="button" onClick={() => removeLinkedDoc(d.id)} className="text-text-muted hover:text-danger">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Mention popover */}
        {showMentionPopover && (
          <MentionPopover
            users={mentionUsers}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentionPopover(false)}
            anchorRect={mentionAnchor}
            selectedIndex={mentionSelectedIndex}
            onHoverIndex={setMentionSelectedIndex}
          />
        )}

        <div className="flex items-end gap-2">
          {/* File upload button */}
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
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
          />

          {/* Link existing doc button */}
          <button
            type="button"
            onClick={() => setShowAttachDialog(true)}
            className="grid size-11 shrink-0 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
            aria-label="Attach from case documents"
            title="Attach from case documents"
          >
            <Link2 className="size-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            name="body"
            rows={2}
            placeholder="Write a message. Use @ to mention someone…"
            onChange={handleTextareaChange}
            onKeyDown={handleComposerKeyDown}
            className="min-h-[44px] flex-1 rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          />

          <Button type="submit" variant="primary" disabled={pending}>
            <Send className="size-4" />
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>

      {/* Attach document dialog */}
      {showAttachDialog && (
        <AttachDocumentDialog
          documents={caseDocuments}
          alreadyLinked={linkedDocIds}
          onLink={(ids) => setLinkedDocIds((prev) => [...prev, ...ids])}
          onClose={() => setShowAttachDialog(false)}
        />
      )}

      {/* In-app File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
