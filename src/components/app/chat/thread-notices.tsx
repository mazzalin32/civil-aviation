"use client";

import { Lock } from "lucide-react";
import { CLOSED_CHAT_MESSAGE } from "@/lib/chat/rules";
import { cn } from "@/lib/utils";

/** Shown in place of the composer once the matter is closed. */
export function ReadOnlyNotice({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 bg-surface-muted/40 text-text-muted", className)}>
      <Lock className="size-3.5" /> {CLOSED_CHAT_MESSAGE}
    </div>
  );
}

/** "Load earlier messages" — shown above the oldest loaded message while older history exists. */
export function LoadEarlierButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-primary hover:bg-surface-muted disabled:opacity-60"
    >
      {loading ? "Loading…" : "Load earlier messages"}
    </button>
  );
}

/** The line above the first message you haven't read yet. */
export function NewMessagesDivider() {
  return (
    <div id="new-messages-divider" className="relative flex items-center justify-center py-1">
      <div className="absolute inset-x-0 top-1/2 border-t border-primary/40" />
      <span className="relative rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
        New messages
      </span>
    </div>
  );
}
