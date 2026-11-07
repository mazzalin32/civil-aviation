"use client";

import { CHAT_NOTIFICATION_TYPES, NOTIFICATION_EVENT } from "@/lib/notifications/links";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  FileCheck2,
  FileSignature,
  FolderOpen,
  Link2,
  LayoutGrid,
  MessageSquare,
  Plus,
  Settings,
  SquareCheckBig,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { NAV, type NavIcon } from "./nav-config";
import { SignOutButton } from "./sign-out-button";
import { UserCard } from "./user-card";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutGrid,
  cases: BriefcaseBusiness,
  calendar: CalendarDays,
  tasks: SquareCheckBig,
  documents: FolderOpen,
  firms: Briefcase,
  chat: MessageSquare,
  links: Link2,
  closure: FileCheck2,
  users: Users,
  reports: BarChart3,
  settings: Settings,
  contracts: FileSignature,
  org: Building2,
};

const STORAGE_KEY = "caa-sidebar-collapsed";

/** Label shown on hover only while the rail is collapsed to icons. */
function Tooltip({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (!collapsed) return null;
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full ml-2 z-20 whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-bg opacity-0 shadow-pop transition-opacity group-hover:opacity-100"
    >
      {label}
    </span>
  );
}

export function Sidebar({ user, openTaskCount = 0, unreadChatCount = 0 }: { user: CurrentUser; openTaskCount?: number; unreadChatCount?: number }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // The chat badge is the server's count plus chat notifications that have arrived live since it was
  // rendered; whenever the server count changes (e.g. after reading a thread) the live part resets.
  const [live, setLive] = useState({ base: unreadChatCount, extra: 0 });
  if (live.base !== unreadChatCount) setLive({ base: unreadChatCount, extra: 0 });
  const chatBadge = unreadChatCount + live.extra;
  useEffect(() => {
    function onNotification(e: Event) {
      const item = (e as CustomEvent<{ type: string }>).detail;
      if (CHAT_NOTIFICATION_TYPES.includes(item.type)) setLive((l) => ({ ...l, extra: l.extra + 1 }));
    }
    window.addEventListener(NOTIFICATION_EVENT, onNotification);
    return () => window.removeEventListener(NOTIFICATION_EVENT, onNotification);
  }, []);

  useEffect(() => {
    // One-time read of a client-only preference on mount (server has no localStorage,
    // so this can't be a lazy initial state without a hydration mismatch).
    try {
      const stored = localStorage.getItem(STORAGE_KEY) === "1";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(stored);
    } catch {
      // Private windows / blocked storage: default to expanded.
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Per-viewer convenience only; fine if it doesn't persist.
      }
      return next;
    });
  }

  const orgName = user.organization?.name ?? (user.role === "SUPERADMIN" ? "Platform Administration" : "CAA Legal Department");
  const logoUrl = user.organization?.logoUrl ?? "/CAA-Uganda-logo-1.png";

  return (
    <aside
      aria-label="Main navigation"
      style={user.organization?.primaryColor ? { backgroundColor: user.organization.primaryColor } : undefined}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 overflow-hidden border-r border-on-primary/10 bg-primary px-3.5 py-4 text-on-primary lg:flex",
        collapsed ? "w-[76px]" : "w-[288px]",
      )}
    >
      <div className={cn("flex items-start gap-2", collapsed ? "flex-col items-center" : "px-0.5")}>
        <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", collapsed && "items-center")}>
          <div aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-control bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" width={80} height={38} style={{ display: "block", maxWidth: "100%", height: "auto" }} />
          </div>
          {!collapsed && <b className="block max-w-full truncate text-[13px] leading-tight font-semibold">{orgName}</b>}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="group relative grid size-7 shrink-0 place-items-center rounded-control text-on-primary/60 transition-colors hover:bg-on-primary/10 hover:text-on-primary"
        >
          {collapsed ? <ChevronsRight className="size-4" strokeWidth={1.8} /> : <ChevronsLeft className="size-4" strokeWidth={1.8} />}
          <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} collapsed={collapsed} />
        </button>
      </div>
      <div className="mt-3 mb-2 border-t border-on-primary/10" />

      <nav className="scrollbar-hidden min-h-0 flex-1 grid gap-1.5 overflow-x-hidden overflow-y-auto">
        {NAV[user.role].map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const badge = item.badgeKey === "openTasks" ? openTaskCount : item.badgeKey === "unreadChat" ? chatBadge : 0;
          return (
            <div key={item.href} className="flex items-center gap-0.5">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex flex-1 items-center gap-2.5 rounded-control px-2.5 py-1.5 font-medium text-on-primary/75 transition-colors hover:bg-on-primary/10 hover:text-on-primary",
                  active && "bg-on-primary/15 text-on-primary hover:bg-on-primary/15",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {badge > 0 && !collapsed && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-warning px-1 text-[11px] font-semibold text-on-primary tabular-nums">
                    {badge}
                  </span>
                )}
                {badge > 0 && collapsed && <span className="absolute top-1 right-1 size-2 rounded-full bg-warning" aria-hidden />}
                <Tooltip label={item.label} collapsed={collapsed} />
              </Link>
              {item.quickAdd && !collapsed && (
                <Link
                  href={item.quickAdd.href}
                  aria-label={item.quickAdd.label}
                  title={item.quickAdd.label}
                  className="grid size-8 shrink-0 place-items-center rounded-control text-on-primary/60 hover:bg-on-primary/10 hover:text-on-primary"
                >
                  <Plus className="size-4" strokeWidth={1.8} />
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <UserCard user={user} collapsed={collapsed} />
      <SignOutButton collapsed={collapsed} />
    </aside>
  );
}
