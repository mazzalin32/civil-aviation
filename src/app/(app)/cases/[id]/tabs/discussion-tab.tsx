"use client";

import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachDocumentDialog, type LinkableDocument } from "@/components/app/chat/attach-document-dialog";
import { matchesThreadSearch, toMentionUsers } from "@/components/app/chat/chat-utils";
import { ThreadSearchBar } from "@/components/app/chat/thread-search-bar";
import { LoadEarlierButton, NewMessagesDivider, ReadOnlyNotice } from "@/components/app/chat/thread-notices";
import { useCaseThread } from "@/components/app/chat/use-case-thread";
import { useMessageComposer } from "@/components/app/chat/use-message-composer";
import { FilePreviewModal, type PreviewFile } from "@/components/app/file-preview-modal";
import { VideoCallPanel } from "@/components/app/video-call-panel";
import type { SerializedChatMessage } from "./discussion-actions";
import { PinnedBanner } from "./pinned-banner";
import { TabComposer } from "./tab-composer";
import { TabMessageBubble } from "./tab-message-bubble";

export type { SerializedChatMessage };

/** The case page's Discussion tab: this matter's thread, assigned counsel and Admins only (spec §5.7). */
export function DiscussionTab({
  matterId,
  currentUserId,
  messages: initialMessages,
  team,
  mentionable,
  caseDocuments,
  canPin,
  readOnly,
  isAdmin,
  hasMoreEarlier,
  cursor,
  lastReadAt,
}: {
  matterId: string;
  currentUserId: string;
  messages: SerializedChatMessage[];
  team: { id: string; name: string; role: string }[];
  /** Who can be @mentioned: the people who can open this chat. */
  mentionable: { id: string; name: string }[];
  caseDocuments: LinkableDocument[];
  canPin: boolean;
  /** Closed matter: no posting, pinning or deleting. */
  readOnly: boolean;
  isAdmin: boolean;
  hasMoreEarlier: boolean;
  cursor: string | null;
  /** How far you had read this thread before opening it (ISO). */
  lastReadAt: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const thread = useCaseThread({ matterId, currentUserId, lastReadAt, endRef, initial: { messages: initialMessages, hasMoreEarlier, cursor } });
  const composer = useMessageComposer({
    matterId,
    mentionUsers: toMentionUsers(mentionable, team),
    caseDocuments,
    onPosted: thread.addMessage,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [callOpen, setCallOpen] = useState(false);

  const visibleMessages = thread.messages.filter((m) => !m.deletedAt && matchesThreadSearch(m, searchQuery));

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowSearch((v) => !v)}>
          <Search className="size-4" />
          {showSearch ? "Close search" : "Search messages"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCallOpen(true)}>
          <Video className="size-4" />
          Start video call
        </Button>
        <Link
          href={`/chat?caseId=${matterId}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-muted"
        >
          <ExternalLink className="size-3.5 text-text-muted" />
          <span>Open in Case Chat Hub</span>
        </Link>
      </div>
      {showSearch && (
        <ThreadSearchBar
          variant="tab"
          query={searchQuery}
          onQueryChange={setSearchQuery}
          matchCount={searchQuery ? visibleMessages.length : 0}
          onClose={() => {
            setSearchQuery("");
            setShowSearch(false);
          }}
        />
      )}

      <PinnedBanner messages={thread.messages} onUnpin={(id) => thread.togglePin(id, false)} canPin={canPin && !readOnly} />

      <div className="grid gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
        {visibleMessages.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">
            {searchQuery ? "No messages match your search." : "No messages yet — start the thread for this case."}
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {thread.hasMore && (
              <li className="flex justify-center">
                <LoadEarlierButton loading={thread.loadingEarlier} onClick={() => thread.loadEarlier(null)} />
              </li>
            )}
            {visibleMessages.map((m) => (
              <Fragment key={m.id}>
                {m.id === thread.firstUnreadId && (
                  <li>
                    <NewMessagesDivider />
                  </li>
                )}
                <TabMessageBubble
                  message={m}
                  mine={m.authorId === currentUserId}
                  canPin={canPin}
                  readOnly={readOnly}
                  isAdmin={isAdmin}
                  onPin={thread.togglePin}
                  onDelete={thread.deleteMessage}
                  onReply={composer.startReply}
                  onEdit={thread.editMessage}
                  onPreview={setPreviewFile}
                />
              </Fragment>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      {readOnly ? (
        <ReadOnlyNotice className="rounded-card border border-border p-4 text-[13px]" />
      ) : (
        <TabComposer composer={composer} />
      )}

      {composer.showAttachDialog && (
        <AttachDocumentDialog
          documents={caseDocuments}
          alreadyLinked={composer.linkedDocIds}
          onLink={composer.linkDocuments}
          onClose={() => composer.setShowAttachDialog(false)}
        />
      )}

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      <VideoCallPanel matterId={matterId} open={callOpen} onClose={() => setCallOpen(false)} />
    </div>
  );
}
