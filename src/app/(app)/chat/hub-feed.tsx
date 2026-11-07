"use client";

import { Fragment, type ReactNode, type RefObject } from "react";
import { Users } from "lucide-react";
import { LoadEarlierButton, NewMessagesDivider } from "@/components/app/chat/thread-notices";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";

/** Empty state for a thread with nothing to show (no messages yet, or none match the search). */
export function HubEmptyThread({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted">
      <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-surface-muted text-text-muted">
        <Users className="size-5" />
      </div>
      <h3 className="m-0 text-[13px] font-semibold text-text">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-text-muted">{text}</p>
    </div>
  );
}

/**
 * The scrolling message area of a hub thread: "load earlier", day separators, the "New messages"
 * divider, and one row per message (rendered by the caller). Shared by case threads and the department channel.
 */
export function HubFeed({
  scrollRef,
  endRef,
  groups,
  hasMore,
  loadingEarlier,
  onLoadEarlier,
  firstUnreadId,
  empty,
  renderMessage,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  groups: { label: string; messages: SerializedChatMessage[] }[];
  hasMore: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  firstUnreadId: string | null;
  /** Shown instead of the messages when there are none to show. */
  empty: ReactNode;
  renderMessage: (message: SerializedChatMessage) => ReactNode;
}) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
      {groups.length === 0 ? (
        empty
      ) : (
        <>
          {hasMore && (
            <div className="flex justify-center">
              <LoadEarlierButton loading={loadingEarlier} onClick={onLoadEarlier} />
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
                    {m.id === firstUnreadId && <NewMessagesDivider />}
                    {renderMessage(m)}
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      <div ref={endRef} />
    </div>
  );
}
