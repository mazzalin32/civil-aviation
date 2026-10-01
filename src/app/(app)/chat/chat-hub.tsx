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
  Users,
  X,
  ChevronDown,
} from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/time";
import { getCaseChatData, type CaseChatData } from "./actions";
import {
  postCaseMessage,
  togglePinCaseMessage,
  deleteCaseMessage,
  type SerializedChatMessage,
  type SerializedChatAttachment,
} from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import { MentionPopover, type MentionUser } from "@/app/(app)/cases/[id]/tabs/mention-popover";
import { AttachDocumentDialog, type LinkableDocument } from "@/app/(app)/cases/[id]/tabs/attach-document-dialog";
import { FilePreviewModal, type PreviewFile } from "@/components/app/file-preview-modal";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type CaseConversationSummary = {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  categoryName: string;
  assignedLawyers: { id: string; name: string; role: string }[];
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    authorName: string;
    authorId: string;
    hasAttachments: boolean;
  } | null;
  messageCount: number;
};

// ------------------------------------------------------------------
// SSE Hook
// ------------------------------------------------------------------

function useCaseChatStream(
  matterId: string | null,
  onMessage: (msg: SerializedChatMessage) => void,
  onPinChange: (data: {
    messageId: string;
    isPinned: boolean;
    pinnedAt: string | null;
    pinnedById: string | null;
    pinnedByName: string | null;
  }) => void,
  onDelete: (data: { messageId: string }) => void
) {
  useEffect(() => {
    if (!matterId) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let retryMs = 1000;

    function connect() {
      if (!matterId) return;
      eventSource = new EventSource(`/api/cases/${matterId}/chat/stream`);

      eventSource.addEventListener("message.created", (e) => {
        try {
          onMessage(JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });

      eventSource.addEventListener("message.pinned", (e) => {
        try {
          onPinChange(JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });

      eventSource.addEventListener("message.deleted", (e) => {
        try {
          onDelete(JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });

      eventSource.addEventListener("connected", () => {
        retryMs = 1000;
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

function formatMessageSnippet(body: string): string {
  return body.replace(/@\[([^\]]+)\]\(user:[^)]+\)/g, "@$1");
}

function renderBody(text: string) {
  const parts = text.split(/(@\[[^\]]+\]\(user:[^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/@\[([^\]]+)\]\(user:[^)]+\)/);
    if (match) {
      return (
        <span
          key={i}
          className="inline-block rounded bg-primary-soft px-1 py-0.5 font-medium text-primary"
        >
          @{match[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return formatDate(date, { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yest";
  if (diffDays < 7) {
    return formatDate(date, { weekday: "short" });
  }
  return formatDate(date, { day: "numeric", month: "short" });
}

function getDateGroupLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - messageDate.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatDate(date, { weekday: "long", day: "numeric", month: "short" });
}

function getStatusDotColor(status: string): string {
  switch (status.toUpperCase()) {
    case "OPEN":
    case "ACTIVE":
      return "bg-success";
    case "HEARING":
      return "bg-warning";
    case "CLOSED":
      return "bg-neutral";
    default:
      return "bg-text-muted";
  }
}

// ------------------------------------------------------------------
// Main CaseChatHub Component
// ------------------------------------------------------------------

export function CaseChatHub({
  currentUserId,
  currentUserRole,
  allCases,
  initialSelectedCaseId,
  initialChatData,
  allLawyers,
}: {
  currentUserId: string;
  currentUserRole: string;
  allCases: CaseConversationSummary[];
  initialSelectedCaseId: string | null;
  initialChatData: CaseChatData | null;
  allLawyers: { id: string; name: string }[];
}) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialSelectedCaseId);
  const [conversations, setConversations] = useState<CaseConversationSummary[]>(allCases);
  const [searchFilter, setSearchFilter] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "assigned">("all");

  // Chat Data for active case
  const [chatData, setChatData] = useState<CaseChatData | null>(initialChatData);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // In-thread search
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [showThreadSearch, setShowThreadSearch] = useState(false);

  // Pinned panel
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);

  // Team dropdown + outside click ref
  const [showTeamPopover, setShowTeamPopover] = useState(false);
  const teamPopoverRef = useRef<HTMLDivElement>(null);

  // Close team popover on outside click
  useEffect(() => {
    if (!showTeamPopover) return;
    function handleClickOutside(e: MouseEvent) {
      if (teamPopoverRef.current && !teamPopoverRef.current.contains(e.target as Node)) {
        setShowTeamPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTeamPopover]);

  // Composer state
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [directFiles, setDirectFiles] = useState<File[]>([]);
  const [linkedDocIds, setLinkedDocIds] = useState<string[]>([]);
  const [showAttachDialog, setShowAttachDialog] = useState(false);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionAnchor, setMentionAnchor] = useState<{ top: number; left: number } | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

  // Track mentions: Map of { id, name } selected by user so textarea shows clean "@Name"
  const [trackedMentions, setTrackedMentions] = useState<{ id: string; name: string }[]>([]);

  // File preview modal state
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const selectedCase = conversations.find((c) => c.id === selectedCaseId) ?? null;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages.length]);

  // Handle switching cases
  const selectCase = useCallback(
    async (caseId: string) => {
      if (caseId === selectedCaseId) return;
      setSelectedCaseId(caseId);
      window.history.replaceState(null, "", `/chat?caseId=${caseId}`);

      setIsLoadingChat(true);
      setThreadSearchQuery("");
      setShowThreadSearch(false);
      setShowPinnedPanel(false);
      setShowTeamPopover(false);
      setDirectFiles([]);
      setLinkedDocIds([]);
      setTrackedMentions([]);

      try {
        const res = await getCaseChatData(caseId);
        if (res.data) {
          setChatData(res.data);
        } else if (res.error) {
          window.alert(res.error);
        }
      } catch {
        window.alert("Failed to load case chat messages.");
      } finally {
        setIsLoadingChat(false);
      }
    },
    [selectedCaseId]
  );

  // SSE Handlers
  const handleIncomingMessage = useCallback(
    (msg: SerializedChatMessage) => {
      if (msg.matterId === selectedCaseId) {
        setChatData((prev) => {
          if (!prev) return prev;
          if (prev.messages.some((m) => m.id === msg.id)) return prev;
          return {
            ...prev,
            messages: [...prev.messages, msg],
          };
        });
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === msg.matterId) {
            return {
              ...c,
              lastMessage: {
                id: msg.id,
                body: msg.body,
                createdAt: msg.createdAt,
                authorName: msg.authorName,
                authorId: msg.authorId,
                hasAttachments: msg.attachments.length > 0,
              },
              messageCount: c.messageCount + 1,
            };
          }
          return c;
        })
      );
    },
    [selectedCaseId]
  );

  const handlePinChange = useCallback(
    (data: {
      messageId: string;
      isPinned: boolean;
      pinnedAt: string | null;
      pinnedById: string | null;
      pinnedByName: string | null;
    }) => {
      setChatData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === data.messageId
              ? {
                  ...m,
                  isPinned: data.isPinned,
                  pinnedAt: data.pinnedAt,
                  pinnedById: data.pinnedById,
                  pinnedByName: data.pinnedByName,
                }
              : m
          ),
        };
      });
    },
    []
  );

  const handleDelete = useCallback((data: { messageId: string }) => {
    setChatData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === data.messageId
            ? { ...m, deletedAt: new Date().toISOString() }
            : m
        ),
      };
    });
  }, []);

  useCaseChatStream(selectedCaseId, handleIncomingMessage, handlePinChange, handleDelete);

  // Pin action handler
  async function handleTogglePin(messageId: string, isPinned: boolean) {
    if (!selectedCaseId) return;
    const res = await togglePinCaseMessage({ matterId: selectedCaseId, messageId, isPinned });
    if (res?.error) {
      window.alert(res.error);
    }
  }

  // Delete message handler
  async function handleDeleteMessage(messageId: string) {
    if (!selectedCaseId) return;
    if (!window.confirm("Are you sure you want to remove this message?")) return;
    const res = await deleteCaseMessage({ matterId: selectedCaseId, messageId });
    if (res?.error) {
      window.alert(res.error);
    }
  }

  // Mention users list
  const mentionUsers: MentionUser[] = allLawyers.map((l) => ({
    id: l.id,
    name: l.name,
    isTeamMember: chatData?.team.some((t) => t.id === l.id),
  }));

  // Sorted mentions list
  const filteredMentions = mentionUsers.filter((u) =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );
  const sortedMentions = [...filteredMentions].sort((a, b) => {
    if (a.isTeamMember && !b.isTeamMember) return -1;
    if (!a.isTeamMember && b.isTeamMember) return 1;
    return a.name.localeCompare(b.name);
  });

  // Reset mention index when query changes
  useEffect(() => {
    setMentionSelectedIndex(0);
  }, [mentionQuery]);

  // Composer mention triggers with accurate caret offset
  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([a-zA-Z0-9_\s]*)$/);

    if (atMatch) {
      const q = atMatch[1];
      if (q.length <= 30) {
        setMentionQuery(q);
        const atIndex = textBefore.lastIndexOf("@");
        const lineBeforeAt = textBefore.slice(0, atIndex).split("\n").pop() || "";
        // Calculate pixel offset along the line (approx 7.2px per character in 13px font)
        const leftOffset = Math.max(8, Math.min(lineBeforeAt.length * 7.2 + 8, 260));
        setMentionAnchor({ top: 0, left: leftOffset });
        setShowMentionPopover(true);
        return;
      }
    }
    setShowMentionPopover(false);
  }

  function handleMentionSelect(user: MentionUser) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const textAfter = value.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf("@");

    if (atIndex !== -1) {
      // Clean natural display in textarea: "@Carol Atim "
      const cleanToken = `@${user.name} `;
      const newText = textBefore.slice(0, atIndex) + cleanToken + textAfter;
      textarea.value = newText;
      const newPos = atIndex + cleanToken.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();

      // Track this user so when sending, it serializes to @[Name](user:id)
      setTrackedMentions((prev) =>
        prev.some((m) => m.id === user.id) ? prev : [...prev, { id: user.id, name: user.name }]
      );
    }
    setShowMentionPopover(false);
  }

  // Keyboard navigation for textarea + mention popover
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

    // Regular send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setDirectFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeDirectFile(index: number) {
    setDirectFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function removeLinkedDoc(id: string) {
    setLinkedDocIds((prev) => prev.filter((d) => d !== id));
  }

  function send() {
    if (!selectedCaseId) return;
    const textarea = textareaRef.current;
    const rawBody = textarea?.value ?? "";

    if (!rawBody.trim() && directFiles.length === 0 && linkedDocIds.length === 0) {
      return;
    }

    // Convert clean "@Name" into serialized Markdown token "@[Name](user:id)" for storage
    let serializedBody = rawBody;
    const finalMentionedUserIds: string[] = [];

    for (const mention of trackedMentions) {
      const cleanToken = `@${mention.name}`;
      if (serializedBody.includes(cleanToken)) {
        serializedBody = serializedBody.split(cleanToken).join(`@[${mention.name}](user:${mention.id})`);
        if (!finalMentionedUserIds.includes(mention.id)) {
          finalMentionedUserIds.push(mention.id);
        }
      }
    }

    // Also pick up any manual tokens
    const manualTokens = extractMentionTokens(serializedBody);
    for (const id of manualTokens) {
      if (!finalMentionedUserIds.includes(id)) {
        finalMentionedUserIds.push(id);
      }
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("matterId", selectedCaseId);
      fd.append("body", serializedBody);
      if (linkedDocIds.length > 0) {
        fd.append("attachedDocumentIds", JSON.stringify(linkedDocIds));
      }
      if (finalMentionedUserIds.length > 0) {
        fd.append("mentionedUserIds", JSON.stringify(finalMentionedUserIds));
      }
      for (const file of directFiles) {
        fd.append("files", file);
      }

      const result = await postCaseMessage(fd);
      if (result?.error) {
        window.alert(result.error);
        return;
      }

      if (textarea) textarea.value = "";
      setDirectFiles([]);
      setLinkedDocIds([]);
      setTrackedMentions([]);
    });
  }

  // Filter conversations in sidebar
  const filteredConversations = conversations.filter((c) => {
    if (filterMode === "assigned") {
      const isAssigned = c.assignedLawyers.some((l) => l.id === currentUserId);
      if (!isAssigned) return false;
    }
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.reference.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.categoryName.toLowerCase().includes(q) ||
      c.assignedLawyers.some((l) => l.name.toLowerCase().includes(q))
    );
  });

  // Filter messages for active case
  const activeMessages = (chatData?.messages ?? []).filter((m) => !m.deletedAt);
  const pinnedMessages = activeMessages.filter((m) => m.isPinned);

  const displayedMessages = activeMessages.filter((m) => {
    if (!threadSearchQuery.trim()) return true;
    const q = threadSearchQuery.toLowerCase();
    const inBody = m.body.toLowerCase().includes(q);
    const inAuthor = m.authorName.toLowerCase().includes(q);
    const inAttachments = m.attachments.some((a) => a.name.toLowerCase().includes(q));
    return inBody || inAuthor || inAttachments;
  });

  // Group messages by date
  const groupedMessages: { label: string; messages: SerializedChatMessage[] }[] = [];
  for (const msg of displayedMessages) {
    const label = getDateGroupLabel(msg.createdAt);
    const existing = groupedMessages.find((g) => g.label === label);
    if (existing) {
      existing.messages.push(msg);
    } else {
      groupedMessages.push({ label, messages: [msg] });
    }
  }

  const linkedDocsList = (chatData?.caseDocuments ?? []).filter((d) =>
    linkedDocIds.includes(d.id)
  );

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[600px] overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      {/* ------------------------------------------------------------ */}
      {/* LEFT SIDEBAR: CASE LIST */}
      {/* ------------------------------------------------------------ */}
      <div className="flex w-72 lg:w-80 shrink-0 flex-col border-r border-border bg-surface select-none">
        {/* Sidebar Header */}
        <div className="border-b border-border/60 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text">Discussions</span>
              <span className="rounded-full bg-surface-muted px-2 py-0.2 text-[11px] font-medium text-text-muted">
                {conversations.length}
              </span>
            </div>
            {currentUserRole === "ADMIN" && (
              <div className="flex items-center rounded-md bg-surface-muted p-0.5 text-[10px] font-medium">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`rounded px-2 py-0.5 transition-colors ${
                    filterMode === "all"
                      ? "bg-surface font-semibold text-text shadow-xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("assigned")}
                  className={`rounded px-2 py-0.5 transition-colors ${
                    filterMode === "assigned"
                      ? "bg-surface font-semibold text-text shadow-xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  My Cases
                </button>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative mt-2.5">
            <Search className="absolute top-2 left-2.5 size-3.5 text-text-muted/70" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search cases or counsel..."
              className="h-8 w-full rounded-md border border-border/50 bg-surface-muted/40 pr-7 pl-8 text-xs text-text placeholder:text-text-muted/60 focus:border-primary/40 focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                className="absolute top-2 right-2 text-text-muted hover:text-text"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">
              {searchFilter
                ? "No matching case chats."
                : "No cases assigned to you."}
            </div>
          ) : (
            filteredConversations.map((item) => {
              const isSelected = item.id === selectedCaseId;
              const hasLastMsg = Boolean(item.lastMessage);
              const isMine = item.lastMessage?.authorId === currentUserId;

              return (
                <div
                  key={item.id}
                  onClick={() => selectCase(item.id)}
                  className={`group relative flex cursor-pointer flex-col rounded-lg px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "bg-surface-muted font-medium text-text shadow-xs ring-1 ring-border/50"
                      : "text-text hover:bg-surface-muted/50"
                  }`}
                >
                  {/* Top row: Reference + Status Dot + Time */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`size-1.5 rounded-full shrink-0 ${getStatusDotColor(item.status)}`} />
                      <span className="font-mono text-xs font-semibold text-text truncate">
                        {item.reference}
                      </span>
                    </div>
                    {hasLastMsg && (
                      <time className="shrink-0 text-[10px] text-text-muted font-normal">
                        {formatRelativeTime(item.lastMessage!.createdAt)}
                      </time>
                    )}
                  </div>

                  {/* Title */}
                  <p className="m-0 mt-0.5 line-clamp-1 text-[12.5px] font-medium text-text">
                    {item.title}
                  </p>

                  {/* Snippet */}
                  <p className="m-0 mt-0.5 truncate text-[11.5px] text-text-muted font-normal">
                    {hasLastMsg ? (
                      <>
                        <span className="text-text/75 font-medium">
                          {isMine ? "You: " : `${item.lastMessage!.authorName.split(" ")[0]}: `}
                        </span>
                        {formatMessageSnippet(item.lastMessage!.body) || (item.lastMessage!.hasAttachments ? "📎 Attachment" : "Sent a message")}
                      </>
                    ) : (
                      <span className="italic text-text-muted/60">No messages yet</span>
                    )}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* RIGHT PANE: ACTIVE CASE CHAT */}
      {/* ------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col overflow-hidden bg-surface">
        {selectedCase ? (
          <>
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-border/60 px-5 bg-surface shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full shrink-0 ${getStatusDotColor(selectedCase.status)}`} />
                  <h1 className="m-0 truncate text-[14px] font-semibold text-text">
                    {selectedCase.title}
                  </h1>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
                  <span className="font-mono text-text/80 font-medium">
                    {selectedCase.reference}
                  </span>
                  <span>·</span>
                  <span>{selectedCase.categoryName}</span>
                  <span>·</span>
                  {/* Counsel Popover Trigger with Ref for outside-click */}
                  <div ref={teamPopoverRef} className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowTeamPopover(!showTeamPopover)}
                      className="inline-flex items-center gap-1 hover:text-text cursor-pointer"
                    >
                      <Users className="size-3 text-text-muted" />
                      <span>{selectedCase.assignedLawyers.length} counsel</span>
                      <ChevronDown className="size-3 text-text-muted" />
                    </button>

                    {showTeamPopover && (
                      <div className="absolute left-0 top-full z-30 mt-1.5 w-60 rounded-lg border border-border bg-surface p-3 shadow-lg">
                        <p className="m-0 mb-2 text-[11px] font-semibold text-text uppercase tracking-wider">
                          Assigned Counsel
                        </p>
                        <ul className="m-0 grid gap-2 list-none p-0 text-xs">
                          {selectedCase.assignedLawyers.map((l) => (
                            <li key={l.id} className="flex items-center gap-2">
                              <Avatar name={l.name} seed={l.id} className="size-5 text-[9px]" />
                              <div className="min-w-0 flex-1">
                                <p className="m-0 truncate font-medium text-text">{l.name}</p>
                                <span className="text-[10px] text-text-muted">{l.role}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                {/* Pinned toggle */}
                <button
                  type="button"
                  onClick={() => setShowPinnedPanel(!showPinnedPanel)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                    showPinnedPanel || pinnedMessages.length > 0
                      ? "bg-primary-soft text-primary font-medium"
                      : "text-text-muted hover:bg-surface-muted hover:text-text"
                  }`}
                  title="Pinned messages"
                >
                  <Pin className="size-3.5" />
                  <span>Pinned</span>
                  {pinnedMessages.length > 0 && (
                    <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                      {pinnedMessages.length}
                    </span>
                  )}
                </button>

                {/* Search toggle */}
                <button
                  type="button"
                  onClick={() => setShowThreadSearch(!showThreadSearch)}
                  className={`grid size-7.5 place-items-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text transition-colors ${
                    showThreadSearch ? "bg-surface-muted text-text" : ""
                  }`}
                  title="Search thread"
                >
                  <Search className="size-3.5" />
                </button>

                {/* Open Case File */}
                <Link
                  href={`/cases/${selectedCase.id}`}
                  className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-xs text-text hover:bg-surface-muted transition-colors ml-1"
                >
                  <span>Open Case File</span>
                  <ExternalLink className="size-3 text-text-muted" />
                </Link>
              </div>
            </div>

            {/* In-thread search bar */}
            {showThreadSearch && (
              <div className="flex items-center gap-2 border-b border-border/60 bg-surface-muted/30 px-5 py-2">
                <Search className="size-3.5 text-text-muted" />
                <input
                  type="text"
                  value={threadSearchQuery}
                  onChange={(e) => setThreadSearchQuery(e.target.value)}
                  placeholder="Filter messages in this case..."
                  className="flex-1 bg-transparent text-xs text-text placeholder:text-text-muted/60 focus:outline-none"
                  autoFocus
                />
                {threadSearchQuery && (
                  <span className="text-[11px] text-text-muted">
                    {displayedMessages.length} match{displayedMessages.length !== 1 ? "es" : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setThreadSearchQuery("");
                    setShowThreadSearch(false);
                  }}
                  className="text-text-muted hover:text-text"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Pinned Messages Drawer */}
            {showPinnedPanel && (
              <div className="border-b border-border/60 bg-primary-soft/15 px-5 py-3">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-primary">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <Pin className="size-3" />
                    Pinned Updates ({pinnedMessages.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPinnedPanel(false)}
                    className="text-text-muted hover:text-text"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {pinnedMessages.length === 0 ? (
                  <p className="m-0 text-xs text-text-muted">
                    No pinned messages. Lead counsel can pin key strategic notes here.
                  </p>
                ) : (
                  <div className="grid gap-2 max-h-40 overflow-y-auto pr-1">
                    {pinnedMessages.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start justify-between gap-2 rounded-md bg-surface border border-border/60 p-2 text-xs shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="m-0 whitespace-pre-wrap text-text">
                            {renderBody(m.body)}
                          </p>
                          <span className="mt-0.5 block text-[10px] text-text-muted">
                            {m.authorName} · {formatDate(new Date(m.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        {chatData?.canPin && (
                          <button
                            type="button"
                            onClick={() => handleTogglePin(m.id, false)}
                            className="text-text-muted hover:text-danger p-0.5"
                            title="Unpin"
                          >
                            <PinOff className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isLoadingChat ? (
                <div className="flex h-full items-center justify-center text-xs text-text-muted">
                  Loading discussion messages...
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted">
                  <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-surface-muted text-text-muted">
                    <Users className="size-5" />
                  </div>
                  <h3 className="m-0 text-[13px] font-semibold text-text">
                    {threadSearchQuery
                      ? "No messages match your search"
                      : "Case Collaboration Thread"}
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-text-muted">
                    {threadSearchQuery
                      ? "Try searching for a different keyword or file name."
                      : `Discussion strictly scoped to assigned counsel (${selectedCase.assignedLawyers.map((l) => l.name).join(", ")}).`}
                  </p>
                </div>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.label} className="space-y-3">
                    {/* Date separator */}
                    <div className="relative flex items-center justify-center my-3">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/50" />
                      </div>
                      <span className="relative rounded-full border border-border/50 bg-surface px-2.5 py-0.5 text-[10px] font-medium text-text-muted shadow-2xs">
                        {group.label}
                      </span>
                    </div>

                    {/* Messages */}
                    <div className="space-y-3">
                      {group.messages.map((m) => {
                        const isMine = m.authorId === currentUserId;
                        const assignmentRole =
                          chatData?.team.find((t) => t.id === m.authorId)?.role ?? null;

                        return (
                          <div
                            key={m.id}
                            id={`msg-${m.id}`}
                            className="group relative flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-surface-muted/30"
                          >
                            <Avatar
                              name={m.authorName}
                              seed={m.authorId}
                              className="size-8 text-xs shrink-0 mt-0.5 rounded-full"
                            />

                            <div className="min-w-0 flex-1 space-y-1">
                              {/* Header: Author + Role + Time + Pin */}
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-text">
                                  {m.authorName}
                                  {isMine && (
                                    <span className="ml-1 text-[11px] font-normal text-text-muted">
                                      (You)
                                    </span>
                                  )}
                                </span>
                                {assignmentRole && (
                                  <span className="rounded bg-surface-muted px-1.5 py-0.2 text-[9px] uppercase font-bold text-text-muted tracking-wider border border-border/40">
                                    {assignmentRole}
                                  </span>
                                )}
                                <time className="text-[10px] text-text-muted">
                                  {formatDate(new Date(m.createdAt), {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </time>
                                {m.isPinned && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                                    <Pin className="size-2.5" /> Pinned
                                  </span>
                                )}
                              </div>

                              {/* Body */}
                              {m.body && (
                                <p className="m-0 text-[13.5px] leading-relaxed text-text whitespace-pre-wrap">
                                  {renderBody(m.body)}
                                </p>
                              )}

                              {/* Attachments */}
                              {m.attachments.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-2">
                                  {m.attachments.map((att) => (
                                    <div
                                      key={att.id}
                                      onClick={() => {
                                        setPreviewFile({
                                          name: att.name,
                                          size: att.size,
                                          mimeType: att.mimeType,
                                          viewUrl: `${att.downloadUrl}?action=view`,
                                          downloadUrl: `${att.downloadUrl}?action=download`,
                                        });
                                      }}
                                      className="group/att inline-flex items-center gap-2 rounded-md border border-border/70 bg-surface px-2.5 py-1 text-xs text-text transition-colors hover:bg-surface-muted shadow-2xs cursor-pointer select-none"
                                      title={`Preview ${att.name}`}
                                    >
                                      {att.isLinkedDocument ? (
                                        <Link2 className="size-3.5 text-primary shrink-0" />
                                      ) : (
                                        <FileText className="size-3.5 text-text-muted shrink-0" />
                                      )}
                                      <span className="truncate max-w-[200px] font-medium group-hover/att:text-primary transition-colors">
                                        {att.name}
                                      </span>
                                      {att.isLinkedDocument && (
                                        <span className="rounded bg-primary-soft px-1 text-[9px] font-semibold text-primary">
                                          Case Doc
                                        </span>
                                      )}
                                      <span className="text-[10px] text-text-muted">
                                        {formatFileSize(att.size)}
                                      </span>
                                      <a
                                        href={`${att.downloadUrl}?action=download`}
                                        download
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded p-0.5 text-text-muted hover:text-text hover:bg-surface-muted/80 transition-colors ml-0.5"
                                        title="Download file"
                                      >
                                        <Download className="size-3 shrink-0" />
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Floating hover toolbar */}
                            <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-border/60 bg-surface px-1 py-0.5 shadow-xs opacity-0 transition-opacity group-hover:opacity-100">
                              {chatData?.canPin && (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePin(m.id, !m.isPinned)}
                                  className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text"
                                  title={m.isPinned ? "Unpin message" : "Pin message"}
                                >
                                  {m.isPinned ? (
                                    <PinOff className="size-3.5" />
                                  ) : (
                                    <Pin className="size-3.5" />
                                  )}
                                </button>
                              )}
                              {(isMine || chatData?.canPin) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(m.id)}
                                  className="rounded p-1 text-text-muted hover:bg-danger-soft hover:text-danger"
                                  title="Delete message"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Unified Composer Container */}
            <div className="border-t border-border/60 p-3.5 bg-surface shrink-0">
              <form
                ref={formRef}
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="relative"
              >
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

                {/* Unified Input Card */}
                <div className="rounded-xl border border-border/70 bg-surface p-2.5 shadow-2xs focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  {/* Pending Attachments Chips */}
                  {(directFiles.length > 0 || linkedDocsList.length > 0) && (
                    <div className="mb-2 flex flex-wrap gap-1.5 pb-2 border-b border-border/40">
                      {directFiles.map((f, i) => (
                        <span
                          key={`file-${i}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-muted/50 px-2 py-0.5 text-xs"
                        >
                          <Paperclip className="size-3 text-text-muted" />
                          <span className="max-w-[140px] truncate">{f.name}</span>
                          <span className="text-text-muted text-[10px]">
                            {formatFileSize(f.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDirectFile(i)}
                            className="text-text-muted hover:text-danger"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                      {linkedDocsList.map((d) => (
                        <span
                          key={`doc-${d.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary-soft px-2 py-0.5 text-xs text-primary"
                        >
                          <Link2 className="size-3" />
                          <span className="max-w-[140px] truncate font-medium">
                            {d.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLinkedDoc(d.id)}
                            className="text-primary hover:text-danger"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    name="body"
                    rows={2}
                    onChange={handleTextareaInput}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`Write a message to ${selectedCase.reference} team...`}
                    className="w-full resize-none border-0 bg-transparent p-1 text-[13px] text-text placeholder:text-text-muted/60 focus:outline-none min-h-[44px] max-h-36"
                  />

                  {/* Bottom Action Bar */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-border/30 mt-1">
                    <div className="flex items-center gap-0.5 text-text-muted">
                      {/* Attach local file */}
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
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                      />

                      {/* Link case document */}
                      <button
                        type="button"
                        onClick={() => setShowAttachDialog(true)}
                        className="grid size-7 place-items-center rounded-md hover:bg-surface-muted hover:text-text transition-colors"
                        title="Link case document"
                      >
                        <Link2 className="size-3.5" />
                      </button>

                      {/* Mention button */}
                      <button
                        type="button"
                        onClick={() => {
                          const textarea = textareaRef.current;
                          if (textarea) {
                            textarea.value += "@";
                            textarea.focus();
                            setMentionQuery("");
                            setMentionAnchor({ top: 0, left: 12 });
                            setShowMentionPopover(true);
                          }
                        }}
                        className="grid size-7 place-items-center rounded-md hover:bg-surface-muted hover:text-text transition-colors text-xs font-semibold"
                        title="Mention counsel"
                      >
                        @
                      </button>

                      <span className="text-[10px] text-text-muted/50 ml-2 hidden sm:inline">
                        Shift+Enter for newline
                      </span>
                    </div>

                    {/* Send button */}
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isPending}
                      className="h-7 px-3 text-xs font-medium rounded-md"
                    >
                      <Send className="size-3 mr-1" />
                      <span>{isPending ? "Sending…" : "Send"}</span>
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {/* Document linking modal */}
            {showAttachDialog && (
              <AttachDocumentDialog
                documents={chatData?.caseDocuments ?? []}
                alreadyLinked={linkedDocIds}
                onLink={(docIds) =>
                  setLinkedDocIds((prev) => Array.from(new Set([...prev, ...docIds])))
                }
                onClose={() => setShowAttachDialog(false)}
              />
            )}

            {/* In-app File Preview Modal */}
            <FilePreviewModal
              file={previewFile}
              onClose={() => setPreviewFile(null)}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-muted">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
              <Users className="size-6" />
            </div>
            <h2 className="m-0 text-sm font-semibold text-text">
              No Case Selected
            </h2>
            <p className="mt-1 max-w-sm text-xs text-text-muted">
              {conversations.length === 0
                ? "You are not assigned to any active cases yet. Case discussions will appear once you are assigned."
                : "Select a case from the sidebar to view discussion messages."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
