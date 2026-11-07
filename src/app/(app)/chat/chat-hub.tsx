"use client";

import { useCallback, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "@/components/ui/toast";
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

  // A message arrived live in the open thread: refresh that conversation's preview line and count.
  const handleIncomingMessage = useCallback((msg: SerializedChatMessage) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === msg.matterId
          ? {
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
            }
          : c,
      ),
    );
  }, []);

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
              onIncomingMessage={handleIncomingMessage}
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
