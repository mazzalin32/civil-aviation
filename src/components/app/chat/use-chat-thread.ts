"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { toast, withToast } from "@/components/ui/toast";
import {
  deleteCaseMessage,
  editCaseMessage,
  loadEarlierCaseMessages,
  markCaseChatRead,
  togglePinCaseMessage,
  type SerializedChatMessage,
} from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications/links";
import { findFirstUnreadId } from "./chat-utils";
import { useCaseChatStream, type PinChange } from "./use-case-chat-stream";

type Options = {
  matterId: string;
  currentUserId: string;
  /** How far the reader had read before opening (ISO); messages from others after it are "new". */
  lastReadAt: string;
  /** Called once the thread has been marked read (the hub uses it to clear that conversation's badge). */
  onRead?: () => void;
  initial: { messages: SerializedChatMessage[]; hasMoreEarlier: boolean; cursor: string | null };
  /** An empty element after the last message; scrolled into view when new messages arrive. */
  endRef: RefObject<HTMLElement | null>;
  /** A message to scroll to and briefly tint once on arrival (deep link from a notification). */
  highlightMessageId?: string | null;
  /** Called for every message that arrives live — the Chat hub uses it to refresh its conversation list. */
  onIncomingMessage?: (msg: SerializedChatMessage) => void;
};

/**
 * Everything one case thread needs on the client, shared by the Chat hub and the Discussion tab:
 * the message list, live updates, "load earlier" paging (keeping the reader's place), auto-scroll to
 * the newest message, the one-off highlight, and pin / delete actions.
 */
export function useCaseThread({ matterId, currentUserId, lastReadAt, onRead, initial, endRef, highlightMessageId = null, onIncomingMessage }: Options) {
  const [messages, setMessages] = useState(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMoreEarlier);
  const [cursor, setCursor] = useState(initial.cursor);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  // Loading older history prepends messages; that must not yank the view to the bottom.
  const skipAutoScrollRef = useRef(false);
  // Where "New messages" goes: fixed when the thread opens, so it stays put while you read.
  const [firstUnreadId] = useState(() => findFirstUnreadId(initial.messages, currentUserId, lastReadAt));
  // On arrival scroll to the linked message, else to the first unread, else to the newest.
  const pendingScrollRef = useRef<string | null>(highlightMessageId ? `msg-${highlightMessageId}` : firstUnreadId ? "new-messages-divider" : null);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightMessageId);

  const onIncomingRef = useRef(onIncomingMessage);
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onIncomingRef.current = onIncomingMessage;
    onReadRef.current = onRead;
  });

  const markRead = useCallback(() => {
    markCaseChatRead(matterId)
      .then(() => {
        onReadRef.current?.();
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT)); // the bell clears this thread's entries
      })
      .catch(() => {});
  }, [matterId]);

  // Opening the thread reads it; so does coming back to the tab while it is open.
  useEffect(() => {
    const readIfVisible = () => {
      if (document.visibilityState === "visible") markRead();
    };
    readIfVisible();
    document.addEventListener("visibilitychange", readIfVisible);
    return () => document.removeEventListener("visibilitychange", readIfVisible);
  }, [markRead]);

  /** Adds a message unless it's already there (our own post arrives both from the action and the stream). */
  const addMessage = useCallback((msg: SerializedChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  const replaceMessage = useCallback((msg: SerializedChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
  }, []);

  const handleIncoming = useCallback(
    (msg: SerializedChatMessage) => {
      addMessage(msg);
      onIncomingRef.current?.(msg);
      // Someone else's message arriving while you are looking at the thread is read as it lands.
      if (msg.authorId !== currentUserId && document.visibilityState === "visible") markRead();
    },
    [addMessage, currentUserId, markRead],
  );

  const handlePinChange = useCallback((data: PinChange) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === data.messageId
          ? { ...m, isPinned: data.isPinned, pinnedAt: data.pinnedAt, pinnedById: data.pinnedById, pinnedByName: data.pinnedByName }
          : m,
      ),
    );
  }, []);

  const handleDeleted = useCallback((data: { messageId: string }) => {
    setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, deletedAt: new Date().toISOString() } : m)));
  }, []);

  useCaseChatStream(matterId, handleIncoming, replaceMessage, handlePinChange, handleDeleted);

  // Scroll to the newest message when one arrives — or, once, to the message a notification linked to.
  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    const pending = pendingScrollRef.current;
    const target = pending ? document.getElementById(pending) : null;
    if (target) {
      pendingScrollRef.current = null;
      target.scrollIntoView({ block: pending === "new-messages-divider" ? "start" : "center" });
      if (!highlightMessageId) return;
      const t = setTimeout(() => setHighlightedId(null), 3500);
      return () => clearTimeout(t);
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, endRef, highlightMessageId]);

  /** `el` is the element that scrolls the thread; pass null when the whole page scrolls (the Discussion tab). */
  async function loadEarlier(el: HTMLElement | null) {
    if (!cursor || loadingEarlier) return;
    setLoadingEarlier(true);
    // Remember where the reader is so prepending history doesn't move what they were looking at.
    const prevHeight = el ? el.scrollHeight : document.documentElement.scrollHeight;
    const prevTop = el ? el.scrollTop : window.scrollY;
    try {
      const res = await loadEarlierCaseMessages({ matterId, before: cursor });
      if (res.error || !res.data) return void toast.error(res.error ?? "Could not load earlier messages.");
      const page = res.data;
      skipAutoScrollRef.current = true;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (el) el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
          else window.scrollTo({ top: prevTop + (document.documentElement.scrollHeight - prevHeight) });
        }),
      );
      setMessages((prev) => {
        const have = new Set(prev.map((m) => m.id));
        return [...page.messages.filter((m) => !have.has(m.id)), ...prev];
      });
      setHasMore(page.hasMore);
      if (page.cursor) setCursor(page.cursor);
    } catch {
      toast.error("Could not load earlier messages.");
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function togglePin(messageId: string, isPinned: boolean) {
    await withToast(togglePinCaseMessage({ matterId, messageId, isPinned }), "Pin updated");
  }

  /** Saves an edit; resolves true on success so the editor can close. */
  async function editMessage(messageId: string, body: string): Promise<boolean> {
    const res = await withToast(editCaseMessage({ matterId, messageId, body }), "Message updated");
    if (res?.data) replaceMessage(res.data);
    return Boolean(res?.data);
  }

  async function deleteMessage(messageId: string) {
    if (!window.confirm("Delete this message? It will be hidden from the thread.")) return;
    await withToast(deleteCaseMessage({ matterId, messageId }), "Message deleted");
  }

  return {
    messages,
    addMessage,
    hasMore,
    loadingEarlier,
    loadEarlier,
    highlightedId,
    togglePin,
    deleteMessage,
    editMessage,
    firstUnreadId,
  };
}
