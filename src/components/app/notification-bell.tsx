"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/time";
import { stripMentionTokens } from "@/lib/mentions";
import {
  CHAT_ACTIVITY_EVENT,
  CHAT_NOTIFICATION_TYPES,
  NOTIFICATION_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
  chatCaseIdFromUrl,
  isDepartmentChatUrl,
} from "@/lib/notifications/links";
import type { NotificationItem } from "@/lib/notifications/item";
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead } from "@/app/(app)/notifications/actions";
import { NotificationRow, notificationMeta } from "./notification-item";

// The live stream does the real work; this slow poll only covers a stream that's been down a while.
/** True for a chat notification about the case whose chat this person is looking at (and the tab is in front). */
function isViewingChatFor(item: NotificationItem): boolean {
  if (document.visibilityState !== "visible" || !CHAT_NOTIFICATION_TYPES.includes(item.type)) return false;
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);
  if (isDepartmentChatUrl(item.url)) return pathname === "/chat" && params.get("channel") === "department";
  const caseId = chatCaseIdFromUrl(item.url);
  if (!caseId) return false;
  if (pathname === "/chat") return params.get("caseId") === caseId;
  return pathname === `/cases/${caseId}` && params.get("tab") === "discussion";
}

const FALLBACK_POLL_MS = 120_000;
const MAX_ITEMS = 20;

const dayKey = (iso: string) => formatDate(new Date(iso), { day: "numeric", month: "numeric", year: "numeric" });

function groupByDay(items: NotificationItem[]) {
  const today = dayKey(new Date().toISOString());
  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const label = dayKey(item.createdAt) === today ? "Today" : "Earlier";
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [ringKey, setRingKey] = useState(0); // bump to replay the bell animation
  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const itemsLoadedRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const loadItems = useCallback(() => {
    setLoadError(false);
    return getNotifications()
      .then((rows) => {
        itemsLoadedRef.current = true;
        setItems(rows);
        setUnread(rows.filter((r) => !r.readAt).length);
      })
      .catch(() => setLoadError(true));
  }, []);

  const refreshCount = useCallback(() => {
    getUnreadNotificationCount().then(setUnread).catch(() => {});
  }, []);

  // Live stream: new notifications arrive the moment the server creates them.
  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");

    // Fires on the first connect *and* on every automatic reconnect — re-sync so anything that
    // arrived while the connection was down still shows up.
    source.addEventListener("connected", () => {
      refreshCount();
      if (itemsLoadedRef.current) void loadItems();
    });

    source.addEventListener("notification", (e) => {
      let item: NotificationItem;
      try {
        item = JSON.parse((e as MessageEvent<string>).data);
      } catch {
        return;
      }
      // Reading that very chat right now? Then this is not news: no toast, wiggle or unread bump (the open
      // thread marks it read on its own), just keep the bell's count honest.
      const viewing = isViewingChatFor(item);
      if (!viewing) window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: item })); // lets the sidebar / chat list react
      // Ask the server rather than adding one: a live event can be an update to a notification you
      // already have (several chat messages collapse into one entry), which must not count twice.
      refreshCount();
      if (!viewing) setRingKey((k) => k + 1);
      setItems((prev) => (prev ? [item, ...prev.filter((i) => i.id !== item.id)].slice(0, MAX_ITEMS) : prev));
      // With the panel closed, a toast is the only sign something just happened.
      if (!openRef.current && !viewing) toast.info(`${notificationMeta(item.type).label}: ${stripMentionTokens(item.message)}`);
    });

    // A department message with no bell entry of its own: tell the sidebar / chat list so their unread badges move.
    source.addEventListener("chat-activity", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent<string>).data) as { channel: string };
        const { pathname, search } = window.location;
        const viewing = data.channel === "department" && pathname === "/chat" && new URLSearchParams(search).get("channel") === "department" && document.visibilityState === "visible";
        if (!viewing) window.dispatchEvent(new CustomEvent(CHAT_ACTIVITY_EVENT, { detail: data }));
      } catch {
        /* ignore malformed events */
      }
    });

    // Something elsewhere (e.g. opening a chat thread) marked notifications read — re-sync.
    function onChanged() {
      refreshCount();
      if (itemsLoadedRef.current) void loadItems();
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);

    return () => {
      source.close();
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [refreshCount, loadItems]);

  useEffect(() => {
    const id = setInterval(refreshCount, FALLBACK_POLL_MS);
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
      loadItems().finally(() => setLoading(false));
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
      <Button size="icon" aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`} aria-expanded={open} onClick={toggle}>
        {/* keyed so each new notification restarts the animation; reduced-motion is handled globally */}
        <Bell key={ringKey} className={cn("size-[18px]", ringKey > 0 && "animate-bell-ring")} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {/* Screen readers hear new arrivals without the panel being open. */}
      <span className="sr-only" role="status" aria-live="polite">
        {unread > 0 ? `${unread} unread notifications` : ""}
      </span>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute top-full right-0 z-30 mt-2 w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-surface shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="m-0 flex items-center gap-2 text-[14px] font-semibold">
              Notifications
              {unread > 0 && <span className="rounded-full bg-primary-soft px-2 py-px text-[11px] font-semibold text-primary tabular-nums">{unread} new</span>}
            </h2>
            {items && items.some((i) => !i.readAt) && (
              <button type="button" onClick={onMarkAllRead} className="text-[12px] font-medium text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loading && !items && (
              <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-text-muted">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            )}
            {loadError && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-text-muted">
                <AlertCircle className="size-5 text-danger" />
                Couldn&apos;t load notifications.
                <button type="button" onClick={() => { setLoading(true); loadItems().finally(() => setLoading(false)); }} className="font-medium text-primary hover:underline">
                  Try again
                </button>
              </div>
            )}
            {!loadError && items && items.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-text-muted">
                <BellOff className="size-5" />
                You&apos;re all caught up.
              </div>
            )}
            {!loadError &&
              items &&
              groupByDay(items).map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 border-b border-border bg-surface-muted px-4 py-1.5 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                    {group.label}
                  </div>
                  <div className="divide-y divide-border">
                    {group.items.map((item) => (
                      <NotificationRow key={item.id} item={item} onActivate={onItemClick} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
