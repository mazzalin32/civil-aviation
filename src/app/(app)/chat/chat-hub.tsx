"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { CHAT_NOTIFICATION_TYPES, NOTIFICATION_EVENT, chatCaseIdFromUrl } from "@/lib/notifications/links";
import type { NotificationItem } from "@/lib/notifications/item";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import { getCaseChatData, type CaseChatData } from "./actions";
import { ConversationList } from "./conversation-list";
import { HubThread, HubThreadPlaceholder } from "./hub-thread";
import type { CaseConversationSummary } from "./types";

export type { CaseConversationSummary };

/**
 * The Chat page: every case conversation you can open on the left, the selected thread on the right.
 * This component only owns *which* conversation is open and its conversation-list summaries; the
 * thread itself (messages, composer, live updates) lives in HubThread.
 */
export function CaseChatHub({
  currentUserId,
  currentUserRole,
  allCases,
  initialSelectedCaseId,
  initialChatData,
  highlightMessageId = null,
}: {
  highlightMessageId?: string | null;
  currentUserId: string;
  currentUserRole: string;
  allCases: CaseConversationSummary[];
  initialSelectedCaseId: string | null;
  initialChatData: CaseChatData | null;
}) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialSelectedCaseId);
  const [conversations, setConversations] = useState<CaseConversationSummary[]>(allCases);
  // The thread data for `loadedCaseId` — it may lag behind `selectedCaseId` while a conversation loads.
  const [chatData, setChatData] = useState<CaseChatData | null>(initialChatData);
  const [loadedCaseId, setLoadedCaseId] = useState<string | null>(initialChatData ? initialSelectedCaseId : null);
  const [loadFailed, setLoadFailed] = useState(false);

  const selectedCase = conversations.find((c) => c.id === selectedCaseId) ?? null;

  const loadCase = useCallback(async (caseId: string) => {
    setLoadFailed(false);
    try {
      const res = await getCaseChatData(caseId);
      if (res.data) {
        setChatData(res.data);
        setLoadedCaseId(caseId);
      } else {
        setLoadFailed(true);
        if (res.error) toast.error(res.error);
      }
    } catch {
      setLoadFailed(true);
      toast.error("Failed to load case chat messages.");
    }
  }, []);

  function selectCase(caseId: string) {
    if (caseId === selectedCaseId) return;
    setSelectedCaseId(caseId);
    window.history.replaceState(null, "", `/chat?caseId=${caseId}`);
    void loadCase(caseId);
  }

  // Reflect the open conversation in the URL (the bell uses it to know which chat you are reading).
  useEffect(() => {
    if (selectedCaseId && !window.location.search.includes("caseId=")) {
      window.history.replaceState(null, "", `/chat?caseId=${selectedCaseId}`);
    }
  }, [selectedCaseId]);

  // The open thread was read: clear its badge.
  const handleRead = useCallback(() => {
    setConversations((prev) => prev.map((c) => (c.id === selectedCaseId && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c)));
  }, [selectedCaseId]);

  // The newest visible message in the open thread changed (arrived, edited or deleted): keep that
  // conversation's preview line honest.
  const handleLatestMessageChange = useCallback(
    (msg: SerializedChatMessage | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedCaseId
            ? {
                ...c,
                lastMessage: msg
                  ? {
                      id: msg.id,
                      body: msg.body,
                      createdAt: msg.createdAt,
                      authorName: msg.authorName,
                      authorId: msg.authorId,
                      hasAttachments: msg.attachments.length > 0,
                    }
                  : null,
              }
            : c,
        ),
      );
    },
    [selectedCaseId],
  );

  // Messages for conversations that are NOT open arrive as bell notifications: count them as unread live.
  useEffect(() => {
    function onNotification(e: Event) {
      const item = (e as CustomEvent<NotificationItem>).detail;
      if (!CHAT_NOTIFICATION_TYPES.includes(item.type)) return;
      const caseId = chatCaseIdFromUrl(item.url);
      if (!caseId || caseId === selectedCaseId) return;
      setConversations((prev) => prev.map((c) => (c.id === caseId ? { ...c, unreadCount: c.unreadCount + 1 } : c)));
    }
    window.addEventListener(NOTIFICATION_EVENT, onNotification);
    return () => window.removeEventListener(NOTIFICATION_EVENT, onNotification);
  }, [selectedCaseId]);

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[600px] overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <ConversationList
        conversations={conversations}
        selectedCaseId={selectedCaseId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onSelect={selectCase}
      />

      <div className="flex flex-1 flex-col overflow-hidden bg-surface">
        {selectedCase ? (
          chatData && loadedCaseId === selectedCase.id ? (
            <HubThread
              key={selectedCase.id}
              selectedCase={selectedCase}
              chatData={chatData}
              currentUserId={currentUserId}
              // The notification deep link applies to the conversation the page opened with, not later ones.
              highlightMessageId={selectedCase.id === initialSelectedCaseId ? highlightMessageId : null}
              onRead={handleRead}
              onLatestMessageChange={handleLatestMessageChange}
            />
          ) : (
            <HubThreadPlaceholder selectedCase={selectedCase} error={loadFailed} onRetry={() => void loadCase(selectedCase.id)} />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-muted">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
              <Users className="size-6" />
            </div>
            <h2 className="m-0 text-sm font-semibold text-text">No Case Selected</h2>
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
