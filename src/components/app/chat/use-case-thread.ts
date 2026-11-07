"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { toast, withToast } from "@/components/ui/toast";
import {
  deleteCaseMessage,
  loadEarlierCaseMessages,
  togglePinCaseMessage,
  type SerializedChatMessage,
} from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import { useCaseChatStream, type PinChange } from "./use-case-chat-stream";

type Options = {
  matterId: string;
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
export function useCaseThread({ matterId, initial, endRef, highlightMessageId = null, onIncomingMessage }: Options) {
  const [messages, setMessages] = useState(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMoreEarlier);
  const [cursor, setCursor] = useState(initial.cursor);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  // Loading older history prepends messages; that must not yank the view to the bottom.
  const skipAutoScrollRef = useRef(false);
  const pendingHighlightRef = useRef<string | null>(highlightMessageId);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightMessageId);

  const onIncomingRef = useRef(onIncomingMessage);
  useEffect(() => {
    onIncomingRef.current = onIncomingMessage;
  });

  /** Adds a message unless it's already there (our own post arrives both from the action and the stream). */
  const addMessage = useCallback((msg: SerializedChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  const handleIncoming = useCallback(
    (msg: SerializedChatMessage) => {
      addMessage(msg);
      onIncomingRef.current?.(msg);
    },
    [addMessage],
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

  useCaseChatStream(matterId, handleIncoming, handlePinChange, handleDeleted);

  // Scroll to the newest message when one arrives — or, once, to the message a notification linked to.
  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    const pending = pendingHighlightRef.current;
    const target = pending ? document.getElementById(`msg-${pending}`) : null;
    if (target) {
      pendingHighlightRef.current = null;
      target.scrollIntoView({ block: "center" });
      const t = setTimeout(() => setHighlightedId(null), 3500);
      return () => clearTimeout(t);
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, endRef]);

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
  };
}
