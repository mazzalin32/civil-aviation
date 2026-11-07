"use client";

import { useState } from "react";
import { Building2, Paperclip, Search, X } from "lucide-react";
import { formatRelativeTime, getStatusDotColor } from "@/components/app/chat/chat-utils";
import { stripMentionTokens } from "@/lib/mentions";
import type { CaseConversationSummary, DepartmentSummary } from "./types";

/** The Chat hub's left column: every conversation you can open, searchable, newest activity first. */
export function ConversationList({
  conversations,
  selectedCaseId,
  currentUserId,
  currentUserRole,
  onSelect,
  department,
  departmentSelected,
  onSelectDepartment,
}: {
  conversations: CaseConversationSummary[];
  /** The case open on the right (null while the department channel is open). */
  selectedCaseId: string | null;
  department: DepartmentSummary;
  departmentSelected: boolean;
  onSelectDepartment: () => void;
  currentUserId: string;
  currentUserRole: string;
  onSelect: (caseId: string) => void;
}) {
  const [searchFilter, setSearchFilter] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "assigned">("all");

  // The department channel is not a case, so the search box and "My Cases" filter only hide it when they should.
  const showDepartment = filterMode === "all" && (!searchFilter.trim() || "department chat".includes(searchFilter.trim().toLowerCase()));

  const filtered = conversations.filter((c) => {
    if (filterMode === "assigned" && !c.assignedLawyers.some((l) => l.id === currentUserId)) return false;
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.reference.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.categoryName.toLowerCase().includes(q) ||
      c.assignedLawyers.some((l) => l.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex w-72 lg:w-80 shrink-0 flex-col border-r border-border bg-surface select-none">
      <div className="border-b border-border/60 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">Discussions</span>
            <span className="rounded-full bg-surface-muted px-2 py-0.2 text-[11px] font-medium text-text-muted">
              {conversations.length}
            </span>
          </div>
          {currentUserRole === "ADMIN" && (
            <div className="flex items-center rounded-md bg-surface-muted p-0.5 text-[10px] font-medium">
              {(
                [
                  ["all", "All"],
                  ["assigned", "My Cases"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`rounded px-2 py-0.5 transition-colors ${
                    filterMode === mode ? "bg-surface font-semibold text-text shadow-xs" : "text-text-muted hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative mt-2.5">
          <Search className="absolute top-2 left-2.5 size-3.5 text-text-muted/70" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search cases or counsel..."
            className="h-8 w-full rounded-md border border-border/50 bg-surface-muted/40 pr-7 pl-8 text-xs text-text placeholder:text-text-muted/60 focus:border-primary/40 focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          {searchFilter && (
            <button type="button" onClick={() => setSearchFilter("")} className="absolute top-2 right-2 text-text-muted hover:text-text">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {showDepartment && (
          <div
            onClick={onSelectDepartment}
            className={`group relative flex cursor-pointer flex-col rounded-lg px-3 py-2.5 transition-colors ${
              departmentSelected
                ? "bg-surface-muted font-medium text-text shadow-xs ring-1 ring-border/50"
                : "text-text hover:bg-surface-muted/50"
            }`}
          >
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Building2 className="size-3.5 shrink-0 text-primary" />
                <span className="text-xs font-semibold text-text truncate">Department chat</span>
              </div>
              {department.lastMessage && (
                <time className="shrink-0 text-[10px] text-text-muted font-normal">{formatRelativeTime(department.lastMessage.createdAt)}</time>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <p className="m-0 min-w-0 flex-1 truncate text-[11.5px] text-text-muted font-normal">
                {department.lastMessage ? (
                  <>
                    <span className="text-text/75 font-medium">
                      {department.lastMessage.authorId === currentUserId ? "You: " : `${department.lastMessage.authorName.split(" ")[0]}: `}
                    </span>
                    {stripMentionTokens(department.lastMessage.body)}
                  </>
                ) : (
                  <span className="italic text-text-muted/60">Everyone in your organisation</span>
                )}
              </p>
              {department.unreadCount > 0 && (
                <span
                  className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-primary tabular-nums"
                  aria-label={`${department.unreadCount} unread`}
                >
                  {department.unreadCount > 99 ? "99+" : department.unreadCount}
                </span>
              )}
            </div>
          </div>
        )}
        {filtered.length === 0 && !showDepartment ? (
          <div className="p-6 text-center text-xs text-text-muted">
            {searchFilter ? "No matching case chats." : "No cases assigned to you."}
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = !departmentSelected && item.id === selectedCaseId;
            const last = item.lastMessage;
            const isMine = last?.authorId === currentUserId;

            return (
              <div
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`group relative flex cursor-pointer flex-col rounded-lg px-3 py-2.5 transition-colors ${
                  isSelected
                    ? "bg-surface-muted font-medium text-text shadow-xs ring-1 ring-border/50"
                    : "text-text hover:bg-surface-muted/50"
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`size-1.5 rounded-full shrink-0 ${getStatusDotColor(item.status)}`} />
                    <span className="font-mono text-xs font-semibold text-text truncate">{item.reference}</span>
                  </div>
                  {last && (
                    <time className="shrink-0 text-[10px] text-text-muted font-normal">{formatRelativeTime(last.createdAt)}</time>
                  )}
                </div>

                <p className={`m-0 mt-0.5 line-clamp-1 text-[12.5px] text-text ${item.unreadCount > 0 ? "font-semibold" : "font-medium"}`}>{item.title}</p>

                <div className="mt-0.5 flex items-center gap-2">
                  <p className="m-0 min-w-0 flex-1 truncate text-[11.5px] text-text-muted font-normal">
                    {last ? (
                      <>
                        <span className="text-text/75 font-medium">{isMine ? "You: " : `${last.authorName.split(" ")[0]}: `}</span>
                        {stripMentionTokens(last.body) ||
                          (last.hasAttachments ? (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="size-3" /> Attachment
                            </span>
                          ) : (
                            "Sent a message"
                          ))}
                      </>
                    ) : (
                      <span className="italic text-text-muted/60">No messages yet</span>
                    )}
                  </p>
                  {item.unreadCount > 0 && (
                    <span
                      className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-primary tabular-nums"
                      aria-label={`${item.unreadCount} unread`}
                    >
                      {item.unreadCount > 99 ? "99+" : item.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
