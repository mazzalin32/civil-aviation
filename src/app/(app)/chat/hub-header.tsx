"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Pin, Search, Users, Video } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { getStatusDotColor } from "@/components/app/chat/chat-utils";
import type { CaseConversationSummary } from "./types";

/** Header of the open conversation: case title and reference, counsel list, and the thread toolbar. */
export function HubHeader({
  selectedCase,
  pinnedCount = 0,
  showPinned = false,
  onTogglePinned,
  showSearch = false,
  onToggleSearch,
  onCall,
}: {
  selectedCase: CaseConversationSummary;
  pinnedCount?: number;
  showPinned?: boolean;
  onTogglePinned?: () => void;
  showSearch?: boolean;
  onToggleSearch?: () => void;
  onCall?: () => void;
}) {
  const [showTeam, setShowTeam] = useState(false);
  const teamRef = useRef<HTMLDivElement>(null);

  // Close the counsel popover on an outside click
  useEffect(() => {
    if (!showTeam) return;
    function onDown(e: MouseEvent) {
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) setShowTeam(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showTeam]);

  return (
    <div className="flex h-14 items-center justify-between border-b border-border/60 px-5 bg-surface shrink-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full shrink-0 ${getStatusDotColor(selectedCase.status)}`} />
          <h1 className="m-0 truncate text-[14px] font-semibold text-text">{selectedCase.title}</h1>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
          <span className="font-mono text-text/80 font-medium">{selectedCase.reference}</span>
          <span>·</span>
          <span>{selectedCase.categoryName}</span>
          <span>·</span>
          <div ref={teamRef} className="relative inline-block">
            <button
              type="button"
              onClick={() => setShowTeam(!showTeam)}
              className="inline-flex items-center gap-1 hover:text-text cursor-pointer"
            >
              <Users className="size-3 text-text-muted" />
              <span>{selectedCase.assignedLawyers.length} counsel</span>
              <ChevronDown className="size-3 text-text-muted" />
            </button>

            {showTeam && (
              <div className="absolute left-0 top-full z-30 mt-1.5 w-60 rounded-lg border border-border bg-surface p-3 shadow-lg">
                <p className="m-0 mb-2 text-[11px] font-semibold text-text uppercase tracking-wider">Assigned Counsel</p>
                <ul className="m-0 grid gap-2 list-none p-0 text-xs">
                  {selectedCase.assignedLawyers.map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <Avatar name={l.name} seed={l.id} className="size-5 text-[9px]" />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 truncate font-medium text-text">{l.name}</p>
                        <span className="text-[10px] text-text-muted">{l.role}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onTogglePinned}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
            showPinned || pinnedCount > 0 ? "bg-primary-soft text-primary font-medium" : "text-text-muted hover:bg-surface-muted hover:text-text"
          }`}
          title="Pinned messages"
        >
          <Pin className="size-3.5" />
          <span>Pinned</span>
          {pinnedCount > 0 && (
            <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-semibold text-primary">{pinnedCount}</span>
          )}
        </button>

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

        <button
          type="button"
          onClick={onCall}
          className="grid size-7.5 place-items-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text transition-colors"
          title="Start video call"
        >
          <Video className="size-3.5" />
        </button>

        <Link
          href={`/cases/${selectedCase.id}`}
          className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-xs text-text hover:bg-surface-muted transition-colors ml-1"
        >
          <span>Open Case File</span>
          <ExternalLink className="size-3 text-text-muted" />
        </Link>
      </div>
    </div>
  );
}
