"use client";

import { useEffect } from "react";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";

export type PinChange = {
  messageId: string;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedById: string | null;
  pinnedByName: string | null;
};

/**
 * Live updates for one case's thread (SSE from /api/cases/:id/chat/stream), reconnecting with
 * exponential backoff. Pass stable (useCallback) handlers — changing them re-subscribes.
 */
export function useCaseChatStream(
  matterId: string | null,
  onMessage: (msg: SerializedChatMessage) => void,
  onEdit: (msg: SerializedChatMessage) => void,
  onPinChange: (data: PinChange) => void,
  onDelete: (data: { messageId: string }) => void,
) {
  useEffect(() => {
    if (!matterId) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let retryMs = 1000;

    function listen<T>(type: string, handler: (data: T) => void) {
      eventSource?.addEventListener(type, (e) => {
        try {
          handler(JSON.parse((e as MessageEvent<string>).data));
        } catch {
          /* ignore malformed events */
        }
      });
    }

    function connect() {
      eventSource = new EventSource(`/api/cases/${matterId}/chat/stream`);
      listen("message.created", onMessage);
      listen("message.edited", onEdit);
      listen("message.pinned", onPinChange);
      listen("message.deleted", onDelete);
      eventSource.addEventListener("connected", () => {
        retryMs = 1000; // healthy again — reset the backoff
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
  }, [matterId, onMessage, onEdit, onPinChange, onDelete]);
}
