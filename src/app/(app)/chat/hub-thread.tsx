"use client";

import { useEffect, useRef, useState } from "react";
import { Fragment } from "react";
import { Users } from "lucide-react";
import { AttachDocumentDialog } from "@/components/app/chat/attach-document-dialog";
import { groupMessagesByDay, matchesThreadSearch, toMentionUsers } from "@/components/app/chat/chat-utils";
import { ThreadSearchBar } from "@/components/app/chat/thread-search-bar";
import { LoadEarlierButton, NewMessagesDivider, ReadOnlyNotice } from "@/components/app/chat/thread-notices";
import { useCaseThread } from "@/components/app/chat/use-case-thread";
import { useMessageComposer } from "@/components/app/chat/use-message-composer";
import { FilePreviewModal, type PreviewFile } from "@/components/app/file-preview-modal";
import { VideoCallPanel } from "@/components/app/video-call-panel";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import type { CaseChatData } from "./actions";
import { HubComposer } from "./hub-composer";
import { HubHeader } from "./hub-header";
import { HubMessageRow } from "./hub-message-row";
import { HubPinnedDrawer } from "./hub-pinned-drawer";
import type { CaseConversationSummary } from "./types";

/**
 * The open conversation in the Chat hub. The hub mounts one of these per case (keyed by case id), so
 * switching conversations starts it fresh — search, pinned drawer and any half-written message reset.
 */
export function HubThread({
  selectedCase,
  chatData,
  currentUserId,
  highlightMessageId,
  onRead,
  onLatestMessageChange,
}: {
  selectedCase: CaseConversationSummary;
  chatData: CaseChatData;
  currentUserId: string;
  highlightMessageId: string | null;
  /** This thread has just been marked read. */
  onRead: () => void;
  /** The newest message that is still visible changed (new, edited or deleted) — keeps the list preview honest. */
  onLatestMessageChange: (msg: SerializedChatMessage | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const thread = useCaseThread({
    matterId: selectedCase.id,
    currentUserId,
    lastReadAt: chatData.lastReadAt,
    onRead,
    initial: chatData,
    endRef,
    highlightMessageId,
  });
  const composer = useMessageComposer({
    matterId: selectedCase.id,
    mentionUsers: toMentionUsers(chatData.mentionable, chatData.team),
    caseDocuments: chatData.caseDocuments,
    onPosted: thread.addMessage,
  });

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPinned, setShowPinned] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [callOpen, setCallOpen] = useState(false);

  const active = thread.messages.filter((m) => !m.deletedAt);
  const pinned = active.filter((m) => m.isPinned);
  const displayed = active.filter((m) => matchesThreadSearch(m, searchQuery));
  const groups = groupMessagesByDay(displayed);

  // Keep the conversation list's preview line in step with what the thread actually shows.
  const latest = active.length > 0 ? active[active.length - 1] : null;
  useEffect(() => {
    onLatestMessageChange(latest);
  }, [latest, onLatestMessageChange]);

  return (
    <>
      <HubHeader
        selectedCase={selectedCase}
        pinnedCount={pinned.length}
        showPinned={showPinned}
        onTogglePinned={() => setShowPinned(!showPinned)}
        showSearch={showSearch}
        onToggleSearch={() => setShowSearch(!showSearch)}
        onCall={() => setCallOpen(true)}
      />

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

      {showPinned && (
        <HubPinnedDrawer
          pinned={pinned}
          canUnpin={chatData.canPin}
          onUnpin={(id) => thread.togglePin(id, false)}
          onClose={() => setShowPinned(false)}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
        {displayed.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted">
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-surface-muted text-text-muted">
              <Users className="size-5" />
            </div>
            <h3 className="m-0 text-[13px] font-semibold text-text">
              {searchQuery ? "No messages match your search" : "Case Collaboration Thread"}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-text-muted">
              {searchQuery
                ? "Try searching for a different keyword or file name."
                : `Discussion strictly scoped to assigned counsel (${selectedCase.assignedLawyers.map((l) => l.name).join(", ")}).`}
            </p>
          </div>
        ) : (
          <>
            {thread.hasMore && (
              <div className="flex justify-center">
                <LoadEarlierButton loading={thread.loadingEarlier} onClick={() => thread.loadEarlier(scrollRef.current)} />
              </div>
            )}
            {groups.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="relative flex items-center justify-center my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <span className="relative rounded-full border border-border/50 bg-surface px-2.5 py-0.5 text-[10px] font-medium text-text-muted shadow-2xs">
                    {group.label}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.messages.map((m) => (
                    <Fragment key={m.id}>
                      {m.id === thread.firstUnreadId && <NewMessagesDivider />}
                    <HubMessageRow
                      message={m}
                      isMine={m.authorId === currentUserId}
                      assignmentRole={chatData.team.find((t) => t.id === m.authorId)?.role ?? null}
                      highlighted={m.id === thread.highlightedId}
                      canPin={chatData.canPin}
                      readOnly={chatData.readOnly}
                      isAdmin={chatData.isAdmin}
                      onPin={thread.togglePin}
                      onDelete={thread.deleteMessage}
                      onReply={composer.startReply}
                      onEdit={thread.editMessage}
                      onPreview={setPreviewFile}
                    />
                    </Fragment>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        <div ref={endRef} />
      </div>

      {chatData.readOnly ? (
        <ReadOnlyNotice className="shrink-0 border-t border-border/60 p-4 text-xs" />
      ) : (
        <HubComposer composer={composer} placeholder={`Write a message to ${selectedCase.reference} team...`} />
      )}

      {composer.showAttachDialog && (
        <AttachDocumentDialog
          documents={chatData.caseDocuments}
          alreadyLinked={composer.linkedDocIds}
          onLink={composer.linkDocuments}
          onClose={() => composer.setShowAttachDialog(false)}
        />
      )}

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      <VideoCallPanel matterId={selectedCase.id} open={callOpen} onClose={() => setCallOpen(false)} />
    </>
  );
}

/** Shown in the right pane while another conversation is loading, or if it couldn't be loaded. */
export function HubThreadPlaceholder({
  selectedCase,
  error,
  onRetry,
}: {
  selectedCase: CaseConversationSummary;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      <HubHeader selectedCase={selectedCase} />
      <div className="flex flex-1 items-center justify-center text-xs text-text-muted">
        {error ? (
          <div className="grid justify-items-center gap-2 text-center">
            <span>Couldn&apos;t load this discussion.</span>
            <button type="button" onClick={onRetry} className="font-medium text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : (
          "Loading discussion messages..."
        )}
      </div>
    </>
  );
}
