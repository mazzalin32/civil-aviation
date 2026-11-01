"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Briefcase,
  CalendarClock,
  CheckCheck,
  FileText,
  GitCommitHorizontal,
  Loader2,
  MessageSquare,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, type NotificationItem } from "@/app/(app)/notifications/actions";

const TYPE_ICON: Record<string, LucideIcon> = {
  HEARING_REMINDER: CalendarClock,
  DEADLINE_REMINDER: CalendarClock,
  HEARING_OUTCOME_MISSING: CalendarClock,
  MESSAGE_MENTION: MessageSquare,
  DOCUMENT_UPLOADED: FileText,
  STAGE_OR_CLOSURE_CHANGED: GitCommitHorizontal,
  CASE_ASSIGNED: Briefcase,
  TASK_ASSIGNED: CheckCheck,
  SUSPICIOUS_ACTIVITY: ShieldAlert,
};

const POLL_MS = 45_000;

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    getUnreadNotificationCount().then(setUnread).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      getNotifications()
        .then((rows) => {
          setItems(rows);
          setUnread(rows.filter((r) => !r.readAt).length);
        })
        .finally(() => setLoading(false));
    }
  }

  async function onItemClick(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)) ?? prev);
      setUnread((n) => Math.max(0, n - 1));
      await markNotificationRead(item.id);
    }
    setOpen(false);
  }

  async function onMarkAllRead() {
    setItems((prev) => prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? prev);
    setUnread(0);
    await markAllNotificationsRead();
  }

  return (
    <div ref={rootRef} className="relative">
      <Button size="icon" aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`} onClick={toggle}>
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute top-full right-0 z-30 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-surface shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="m-0 text-[13.5px] font-semibold">Notifications</h2>
            {items && items.some((i) => !i.readAt) && (
              <button type="button" onClick={onMarkAllRead} className="text-[12px] font-medium text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-text-muted">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            )}
            {!loading && items && items.length === 0 && (
              <p className="m-0 px-4 py-8 text-center text-[13px] text-text-muted">No notifications yet.</p>
            )}
            {!loading &&
              items?.map((item) => {
                const Icon = TYPE_ICON[item.type] ?? Bell;
                const body = (
                  <div
                    className={cn(
                      "flex items-start gap-2.5 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-muted",
                      !item.readAt && "bg-primary-soft/40",
                    )}
                  >
                    <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", item.readAt ? "bg-surface-muted text-text-muted" : "bg-primary-soft text-primary")}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[13px] leading-snug", !item.readAt && "font-medium text-text")}>{item.message}</span>
                      <span className="mt-0.5 block text-[11px] text-text-muted">{timeAgo(new Date(item.createdAt))} ago</span>
                    </span>
                    {!item.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                  </div>
                );
                return item.url ? (
                  <Link key={item.id} href={item.url} role="menuitem" onClick={() => onItemClick(item)} className="block">
                    {body}
                  </Link>
                ) : (
                  <button key={item.id} type="button" role="menuitem" onClick={() => onItemClick(item)} className="block w-full">
                    {body}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
