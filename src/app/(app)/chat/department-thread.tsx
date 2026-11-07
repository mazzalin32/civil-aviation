"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Search } from "lucide-react";
import { groupMessagesByDay, matchesThreadSearch, toMentionUsers } from "@/components/app/chat/chat-utils";
import { ThreadSearchBar } from "@/components/app/chat/thread-search-bar";
import { departmentThreadApi } from "@/components/app/chat/thread-api";
import { useChatThread } from "@/components/app/chat/use-chat-thread";
import { useMessageComposer } from "@/components/app/chat/use-message-composer";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import type { DepartmentChatData } from "./department-actions";
import { HubComposer } from "./hub-composer";
import { HubEmptyThread, HubFeed } from "./hub-feed";
import { HubMessageRow } from "./hub-message-row";

/** Header of the department channel: who it is for, plus search. */
export function DepartmentHeader({
  memberCount,
  showSearch = false,
  onToggleSearch,
}: {
  memberCount?: number;
  showSearch?: boolean;
  onToggleSearch?: () => void;
}) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-border/60 px-5 bg-surface shrink-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <Building2 className="size-4" />
        </span>
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[14px] font-semibold text-text">Department chat</h1>
          <p className="m-0 text-[11px] text-text-muted">
            Everyone in your organisation{memberCount ? ` · ${memberCount} people` : ""} — for matters that affect the whole department
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleSearch}
        className={`grid size-7.5 place-items-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text transition-colors ${
          showSearch ? "bg-surface-muted text-text" : ""
        }`}
        title="Search thread"
      >
        <Search className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * The department channel in the Chat hub. Same live thread, composer, edit / reply / delete and unread
 * behaviour as a case thread (they share the hooks), minus pinning, files and voice notes.
 */
export function DepartmentThread({
  data,
  currentUserId,
  highlightMessageId,
  onRead,
  onLatestMessageChange,
}: {
  data: DepartmentChatData;
  currentUserId: string;
  highlightMessageId: string | null;
  onRead: () => void;
  onLatestMessageChange: (msg: SerializedChatMessage | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const api = useMemo(() => departmentThreadApi(), []);
  const thread = useChatThread({ api, currentUserId, lastReadAt: data.lastReadAt, onRead, initial: data, endRef, highlightMessageId });
  const composer = useMessageComposer({ api, mentionUsers: toMentionUsers(data.members, []), caseDocuments: [], onPosted: thread.addMessage });

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const active = thread.messages.filter((m) => !m.deletedAt);
  const displayed = active.filter((m) => matchesThreadSearch(m, searchQuery));
  const groups = groupMessagesByDay(displayed);

  // Keep the conversation list's preview line in step with what the thread actually shows.
  const latest = active.length > 0 ? active[active.length - 1] : null;
  useEffect(() => {
    onLatestMessageChange(latest);
  }, [latest, onLatestMessageChange]);

  return (
    <>
      <DepartmentHeader memberCount={data.members.length} showSearch={showSearch} onToggleSearch={() => setShowSearch(!showSearch)} />

      {showSearch && (
        <ThreadSearchBar
          variant="hub"
          query={searchQuery}
          onQueryChange={setSearchQuery}
          matchCount={displayed.length}
          onClose={() => {
            setSearchQuery("");
            setShowSearch(false);
          }}
        />
      )}

      <HubFeed
        scrollRef={scrollRef}
        endRef={endRef}
        groups={groups}
        hasMore={thread.hasMore}
        loadingEarlier={thread.loadingEarlier}
        onLoadEarlier={() => thread.loadEarlier(scrollRef.current)}
        firstUnreadId={thread.firstUnreadId}
        empty={
          <HubEmptyThread
            title={searchQuery ? "No messages match your search" : "Department chat"}
            text={searchQuery ? "Try searching for a different keyword." : "Post updates that affect everyone here. For one matter, use that case's own discussion."}
          />
        }
        renderMessage={(m) => (
          <HubMessageRow
            message={m}
            isMine={m.authorId === currentUserId}
            assignmentRole={null}
            highlighted={m.id === thread.highlightedId}
            canPin={false}
            readOnly={false}
            isAdmin={data.isAdmin}
            onPin={thread.togglePin}
            onDelete={thread.deleteMessage}
            onReply={composer.startReply}
            onEdit={thread.editMessage}
            onPreview={() => {}}
          />
        )}
      />

      <HubComposer composer={composer} placeholder="Write to everyone in the department..." allowAttachments={false} />
    </>
  );
}
