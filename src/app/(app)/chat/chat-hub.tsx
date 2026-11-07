"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  CHAT_ACTIVITY_EVENT,
  CHAT_NOTIFICATION_TYPES,
  NOTIFICATION_EVENT,
  chatCaseIdFromUrl,
  isDepartmentChatUrl,
} from "@/lib/notifications/links";
import { DEPARTMENT_CHANNEL_NAME } from "@/lib/chat/channels";
import type { NotificationItem } from "@/lib/notifications/item";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import { getCaseChatData, type CaseChatData } from "./actions";
import { ConversationList } from "./conversation-list";
import { getDepartmentChatData, type DepartmentChatData } from "./department-actions";
import { DepartmentHeader, DepartmentThread } from "./department-thread";
import { HubHeader } from "./hub-header";
import { HubThread, HubThreadPlaceholder } from "./hub-thread";
import type { CaseConversationSummary, DepartmentSummary } from "./types";

export type { CaseConversationSummary, DepartmentSummary };

const toLastMessage = (msg: SerializedChatMessage | null): CaseConversationSummary["lastMessage"] =>
  msg
    ? {
        id: msg.id,
        body: msg.body,
        createdAt: msg.createdAt,
        authorName: msg.authorName,
        authorId: msg.authorId,
        hasAttachments: msg.attachments.length > 0,
      }
    : null;

/**
 * The Chat page: the department channel and every case conversation you can open on the left, the
 * selected thread on the right. This component only owns *which* conversation is open and the
 * conversation-list summaries; each thread (messages, composer, live updates) lives in its own component.
 */
export function CaseChatHub({
  currentUserId,
  currentUserRole,
  allCases,
  department: initialDepartment,
  initialView,
  initialSelectedCaseId,
  initialChatData,
  initialDepartmentData,
  highlightMessageId = null,
}: {
  highlightMessageId?: string | null;
  currentUserId: string;
  currentUserRole: string;
  allCases: CaseConversationSummary[];
  department: DepartmentSummary;
  /** Which kind of conversation the page opened on. */
  initialView: "case" | "department";
  initialSelectedCaseId: string | null;
  initialChatData: CaseChatData | null;
  initialDepartmentData: DepartmentChatData | null;
}) {
  const [view, setView] = useState<"case" | "department">(initialView);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialSelectedCaseId);
  const [conversations, setConversations] = useState<CaseConversationSummary[]>(allCases);
  const [department, setDepartment] = useState<DepartmentSummary>(initialDepartment);
  // Thread data for `loadedCaseId` — it may lag behind `selectedCaseId` while a conversation loads.
  const [chatData, setChatData] = useState<CaseChatData | null>(initialChatData);
  const [loadedCaseId, setLoadedCaseId] = useState<string | null>(initialChatData ? initialSelectedCaseId : null);
  const [departmentData, setDepartmentData] = useState<DepartmentChatData | null>(initialDepartmentData);
  const [loadFailed, setLoadFailed] = useState(false);

  const selectedCase = conversations.find((c) => c.id === selectedCaseId) ?? null;
  const departmentOpen = view === "department";

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

  const loadDepartment = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await getDepartmentChatData();
      if (res.data) setDepartmentData(res.data);
      else {
        setLoadFailed(true);
        if (res.error) toast.error(res.error);
      }
    } catch {
      setLoadFailed(true);
      toast.error("Failed to load the department chat.");
    }
  }, []);

  function selectCase(caseId: string) {
    if (view === "case" && caseId === selectedCaseId) return;
    setView("case");
    setSelectedCaseId(caseId);
    window.history.replaceState(null, "", `/chat?caseId=${caseId}`);
    if (loadedCaseId !== caseId) void loadCase(caseId);
  }

  function selectDepartment() {
    if (departmentOpen) return;
    setView("department");
    window.history.replaceState(null, "", "/chat?channel=department");
    void loadDepartment(); // always fresh: it may have changed while you were in a case
    setDepartmentData(null);
  }

  // Reflect the open conversation in the URL (the bell uses it to know which chat you are reading).
  useEffect(() => {
    if (window.location.search.includes("caseId=") || window.location.search.includes("channel=")) return;
    if (departmentOpen) window.history.replaceState(null, "", "/chat?channel=department");
    else if (selectedCaseId) window.history.replaceState(null, "", `/chat?caseId=${selectedCaseId}`);
  }, [departmentOpen, selectedCaseId]);

  // ---- the open case thread
  const handleRead = useCallback(() => {
    setConversations((prev) => prev.map((c) => (c.id === selectedCaseId && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c)));
  }, [selectedCaseId]);

  // The newest visible message changed (arrived, edited or deleted): keep the list's preview line honest.
  const handleLatestMessageChange = useCallback(
    (msg: SerializedChatMessage | null) => {
      setConversations((prev) => prev.map((c) => (c.id === selectedCaseId ? { ...c, lastMessage: toLastMessage(msg) } : c)));
    },
    [selectedCaseId],
  );

  // ---- the open department thread
  const handleDepartmentRead = useCallback(() => {
    setDepartment((d) => (d.unreadCount > 0 ? { ...d, unreadCount: 0 } : d));
  }, []);
  const handleDepartmentLatest = useCallback((msg: SerializedChatMessage | null) => {
    setDepartment((d) => ({ ...d, lastMessage: toLastMessage(msg) }));
  }, []);

  // Messages in conversations that are NOT open arrive as bell notifications (mentions, replies, case
  // messages) or silent chat-activity pings (department messages): count them as unread live.
  useEffect(() => {
    function onNotification(e: Event) {
      const item = (e as CustomEvent<NotificationItem>).detail;
      if (!CHAT_NOTIFICATION_TYPES.includes(item.type)) return;
      if (isDepartmentChatUrl(item.url)) {
        if (!departmentOpen) setDepartment((d) => ({ ...d, unreadCount: d.unreadCount + 1 }));
        return;
      }
      const caseId = chatCaseIdFromUrl(item.url);
      if (!caseId || (!departmentOpen && caseId === selectedCaseId)) return;
      setConversations((prev) => prev.map((c) => (c.id === caseId ? { ...c, unreadCount: c.unreadCount + 1 } : c)));
    }
    function onActivity(e: Event) {
      const { channel } = (e as CustomEvent<{ channel: string }>).detail;
      if (channel === DEPARTMENT_CHANNEL_NAME && !departmentOpen) setDepartment((d) => ({ ...d, unreadCount: d.unreadCount + 1 }));
    }
    window.addEventListener(NOTIFICATION_EVENT, onNotification);
    window.addEventListener(CHAT_ACTIVITY_EVENT, onActivity);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT, onNotification);
      window.removeEventListener(CHAT_ACTIVITY_EVENT, onActivity);
    };
  }, [selectedCaseId, departmentOpen]);

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[600px] overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <ConversationList
        conversations={conversations}
        selectedCaseId={departmentOpen ? null : selectedCaseId}
        department={department}
        departmentSelected={departmentOpen}
        onSelectDepartment={selectDepartment}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onSelect={selectCase}
      />

      <div className="flex flex-1 flex-col overflow-hidden bg-surface">
        {departmentOpen ? (
          departmentData ? (
            <DepartmentThread
              key="department"
              data={departmentData}
              currentUserId={currentUserId}
              highlightMessageId={initialView === "department" ? highlightMessageId : null}
              onRead={handleDepartmentRead}
              onLatestMessageChange={handleDepartmentLatest}
            />
          ) : (
            <HubThreadPlaceholder header={<DepartmentHeader />} error={loadFailed} onRetry={() => void loadDepartment()} />
          )
        ) : selectedCase ? (
          chatData && loadedCaseId === selectedCase.id ? (
            <HubThread
              key={selectedCase.id}
              selectedCase={selectedCase}
              chatData={chatData}
              currentUserId={currentUserId}
              // The notification deep link applies to the conversation the page opened with, not later ones.
              highlightMessageId={initialView === "case" && selectedCase.id === initialSelectedCaseId ? highlightMessageId : null}
              onRead={handleRead}
              onLatestMessageChange={handleLatestMessageChange}
            />
          ) : (
            <HubThreadPlaceholder header={<HubHeader selectedCase={selectedCase} />} error={loadFailed} onRetry={() => void loadCase(selectedCase.id)} />
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
