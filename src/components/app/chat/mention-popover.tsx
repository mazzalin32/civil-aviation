"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/app/avatar";

export type MentionUser = {
  id: string;
  name: string;
  role?: string;
  isTeamMember?: boolean;
};

/**
 * Popover that appears when a user types "@" in the chat composer.
 * Lists case team members first, then other department lawyers.
 */
export function MentionPopover({
  users,
  query,
  onSelect,
  onClose,
  anchorRect,
  selectedIndex = 0,
  onHoverIndex,
}: {
  users: MentionUser[];
  query: string;
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number } | null;
  selectedIndex?: number;
  onHoverIndex?: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase())
  );

  // Sort: team members first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    if (a.isTeamMember && !b.isTeamMember) return -1;
    if (!a.isTeamMember && b.isTeamMember) return 1;
    return a.name.localeCompare(b.name);
  });

  // Handle click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (sorted.length === 0 || !anchorRect) return null;

  // Clamp left offset so popover stays nicely within the composer
  const clampedLeft = Math.max(8, Math.min(anchorRect.left, 240));

  return (
    <div
      ref={containerRef}
      className="absolute z-50 min-w-[240px] max-w-[300px] rounded-lg border border-border bg-surface p-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={{
        bottom: `calc(100% + 8px)`,
        left: `${clampedLeft}px`,
      }}
    >
      <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
        Mention Counsel
      </div>
      <ul ref={listRef} className="m-0 max-h-[220px] list-none overflow-y-auto p-0 space-y-0.5">
        {sorted.map((user, i) => (
          <li key={user.id}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                i === selectedIndex
                  ? "bg-primary-soft text-primary font-medium"
                  : "text-text hover:bg-surface-muted"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(user);
              }}
              onMouseEnter={() => onHoverIndex?.(i)}
            >
              <Avatar name={user.name} seed={user.id} className="size-5.5 text-[9px] shrink-0" />
              <span className="flex-1 truncate">{user.name}</span>
              {user.isTeamMember && (
                <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-medium text-primary shrink-0">
                  Case Team
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
