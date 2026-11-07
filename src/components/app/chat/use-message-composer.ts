"use client";

import { useState, useTransition } from "react";
import { toast, withToast } from "@/components/ui/toast";
import { postCaseMessage, type SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import type { MentionUser } from "./mention-popover";
import type { LinkableDocument } from "./attach-document-dialog";
import { previewText } from "@/lib/mentions";
import { REPLY_SNIPPET_CHARS } from "@/lib/chat/rules";
import { serializeMentions } from "./chat-utils";

type Options = {
  matterId: string;
  /** Everyone who can be @mentioned in this chat. */
  mentionUsers: MentionUser[];
  caseDocuments: LinkableDocument[];
  /** Called with the saved message right after a successful post (the live stream may be slower). */
  onPosted?: (msg: SerializedChatMessage) => void;
};

/**
 * Composer state and behaviour shared by the Chat hub and the Discussion tab: the textarea with its
 * @mention autocomplete, attached files and linked case documents, and sending. The two screens
 * render this differently; the logic is the same.
 */
export function useMessageComposer({ matterId, mentionUsers, caseDocuments, onPosted }: Options) {
  const [pending, startTransition] = useTransition();

  const [directFiles, setDirectFiles] = useState<File[]>([]);
  const [linkedDocIds, setLinkedDocIds] = useState<string[]>([]);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string; snippet: string } | null>(null);

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionAnchor, setMentionAnchor] = useState<{ top: number; left: number } | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  // People picked from the autocomplete: the textarea shows a clean "@Name", the token is added on send.
  const [trackedMentions, setTrackedMentions] = useState<{ id: string; name: string }[]>([]);

  const sortedMentions = mentionUsers
    .filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isTeamMember && !b.isTeamMember) return -1;
      if (!a.isTeamMember && b.isTeamMember) return 1;
      return a.name.localeCompare(b.name);
    });

  // Reset the highlighted suggestion when the query changes. Done during render (React's "adjust state
  // when a prop/state changes" pattern) rather than in an effect, which would render the stale index first.
  const [prevMentionQuery, setPrevMentionQuery] = useState(mentionQuery);
  if (prevMentionQuery !== mentionQuery) {
    setPrevMentionQuery(mentionQuery);
    setMentionSelectedIndex(0);
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([a-zA-Z0-9_\s]*)$/);

    if (atMatch && atMatch[1].length <= 30) {
      setMentionQuery(atMatch[1]);
      const atIndex = textBefore.lastIndexOf("@");
      const lineBeforeAt = textBefore.slice(0, atIndex).split("\n").pop() || "";
      // Approximate pixel offset along the line (≈7.2px per character at 13px)
      setMentionAnchor({ top: 0, left: Math.max(8, Math.min(lineBeforeAt.length * 7.2 + 8, 260)) });
      setShowMentionPopover(true);
      return;
    }
    setShowMentionPopover(false);
  }

  /** The "@" toolbar button: start a mention at the end of the text. */
  function startMention(textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    textarea.value += "@";
    textarea.focus();
    setMentionQuery("");
    setMentionAnchor({ top: 0, left: 12 });
    setShowMentionPopover(true);
  }

  function selectMention(user: MentionUser, textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;

    const value = textarea.value;
    const cursorPos = textarea.selectionStart ?? value.length;
    const textBefore = value.slice(0, cursorPos);
    const textAfter = value.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf("@");

    if (atIndex !== -1) {
      const cleanToken = `@${user.name} `;
      textarea.value = textBefore.slice(0, atIndex) + cleanToken + textAfter;
      const newPos = atIndex + cleanToken.length;
      textarea.setSelectionRange(newPos, newPos);
      setTrackedMentions((prev) => (prev.some((m) => m.id === user.id) ? prev : [...prev, { id: user.id, name: user.name }]));
    }
    setShowMentionPopover(false);
    textarea.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
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
        if (sortedMentions[mentionSelectedIndex]) selectMention(sortedMentions[mentionSelectedIndex], e.currentTarget);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionPopover(false);
        return;
      }
    }

    // Enter sends; Shift+Enter is a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(e.currentTarget);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setDirectFiles((prev) => [...prev, ...files]);
    e.target.value = ""; // so picking the same file again still fires onChange
  }

  const startReply = (m: SerializedChatMessage) =>
    setReplyingTo({ id: m.id, authorName: m.authorName, snippet: previewText(m.body, REPLY_SNIPPET_CHARS) });
  const cancelReply = () => setReplyingTo(null);
  const addFile = (file: File) => setDirectFiles((prev) => [...prev, file]);
  const removeDirectFile = (index: number) => setDirectFiles((prev) => prev.filter((_, i) => i !== index));
  const removeLinkedDoc = (id: string) => setLinkedDocIds((prev) => prev.filter((d) => d !== id));
  const linkDocuments = (ids: string[]) => setLinkedDocIds((prev) => Array.from(new Set([...prev, ...ids])));

  const linkedDocs = linkedDocIds
    .map((id) => caseDocuments.find((d) => d.id === id))
    .filter((d): d is LinkableDocument => Boolean(d));

  function send(textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    const raw = textarea.value;
    if (!raw.trim() && directFiles.length === 0 && linkedDocIds.length === 0) return;

    const body = serializeMentions(raw, trackedMentions);

    startTransition(async () => {
      const fd = new FormData();
      fd.append("matterId", matterId);
      fd.append("body", body);
      if (linkedDocIds.length > 0) fd.append("attachedDocumentIds", JSON.stringify(linkedDocIds));
      if (replyingTo) fd.append("replyToId", replyingTo.id);
      for (const file of directFiles) fd.append("files", file);

      const result = await withToast(postCaseMessage(fd), null);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.data) onPosted?.(result.data);

      textarea.value = "";
      setDirectFiles([]);
      setLinkedDocIds([]);
      setTrackedMentions([]);
      setReplyingTo(null);
    });
  }

  return {
    pending,
    send,
    handleTextareaChange,
    handleKeyDown,
    handleFileSelect,
    addFile,
    directFiles,
    removeDirectFile,
    linkedDocs,
    linkedDocIds,
    removeLinkedDoc,
    linkDocuments,
    showAttachDialog,
    setShowAttachDialog,
    replyingTo,
    startReply,
    cancelReply,
    mention: {
      show: showMentionPopover,
      users: mentionUsers,
      query: mentionQuery,
      anchor: mentionAnchor,
      selectedIndex: mentionSelectedIndex,
      setSelectedIndex: setMentionSelectedIndex,
      select: selectMention,
      close: () => setShowMentionPopover(false),
      start: startMention,
    },
  };
}

export type MessageComposer = ReturnType<typeof useMessageComposer>;
