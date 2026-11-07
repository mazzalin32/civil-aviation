"use client";

import { Search, X } from "lucide-react";

/** The "filter messages in this case" bar (matches body, author and attachment names). */
export function ThreadSearchBar({
  query,
  onQueryChange,
  matchCount,
  onClose,
  variant,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  onClose: () => void;
  variant: "hub" | "tab";
}) {
  const hub = variant === "hub";
  return (
    <div
      className={
        hub
          ? "flex items-center gap-2 border-b border-border/60 bg-surface-muted/30 px-5 py-2"
          : "flex flex-1 items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5"
      }
    >
      <Search className="size-3.5 text-text-muted" />
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={hub ? "Filter messages in this case..." : "Filter messages, people, or files…"}
        className={
          hub
            ? "flex-1 bg-transparent text-xs text-text placeholder:text-text-muted/60 focus:outline-none"
            : "flex-1 border-0 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
        }
        autoFocus
      />
      {query && (
        <span className="text-[11px] text-text-muted">
          {matchCount} match{matchCount !== 1 ? "es" : ""}
        </span>
      )}
      <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
