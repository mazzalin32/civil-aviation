"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  FileCheck2,
  LayoutGrid,
  Plus,
  Scale,
  Settings,
  SquareCheckBig,
  Upload,
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
  closure: FileCheck2,
  users: Users,
  reports: BarChart3,
  import: Upload,
  settings: Settings,
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

export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-on-primary/10 bg-primary px-3.5 py-5 text-on-primary lg:flex",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex items-center gap-2.5", collapsed ? "justify-center px-0" : "px-2")}>
        <div aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-control bg-on-primary/15">
          <Scale className="size-[18px]" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <b className="block truncate text-sm font-semibold">CAA Legal</b>
            <small className="block truncate text-xs text-on-primary/70">Uganda Civil Aviation Authority</small>
          </div>
        )}
      </div>

      {/* Kept at the top, above the nav list, so it stays reachable as more links are added below. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "group relative mt-3 mb-2 flex items-center gap-2.5 rounded-control px-2.5 py-1.5 text-xs font-medium text-on-primary/60 transition-colors hover:bg-on-primary/10 hover:text-on-primary",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? <ChevronsRight className="size-4 shrink-0" strokeWidth={1.8} /> : <ChevronsLeft className="size-4 shrink-0" strokeWidth={1.8} />}
        {!collapsed && "Collapse menu"}
        <Tooltip label="Expand sidebar" collapsed={collapsed} />
      </button>
      <div className="mb-2 border-t border-on-primary/10" />

      <nav className="grid gap-0.5">
        {NAV[user.role].map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <div key={item.href} className="flex items-center gap-0.5">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex flex-1 items-center gap-2.5 rounded-control px-2.5 py-2 font-medium text-on-primary/75 transition-colors hover:bg-on-primary/10 hover:text-on-primary",
                  active && "bg-on-primary/15 text-on-primary hover:bg-on-primary/15",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                {!collapsed && item.label}
                <Tooltip label={item.label} collapsed={collapsed} />
              </Link>
              {item.quickAdd && !collapsed && (
                <Link
                  href={item.quickAdd.href}
                  aria-label={item.quickAdd.label}
                  className="group relative grid size-8 shrink-0 place-items-center rounded-control text-on-primary/60 hover:bg-on-primary/10 hover:text-on-primary"
                >
                  <Plus className="size-4" strokeWidth={1.8} />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full ml-2 z-20 whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-bg opacity-0 shadow-pop transition-opacity group-hover:opacity-100"
                  >
                    {item.quickAdd.label}
                  </span>
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex-1" />

      <UserCard user={user} collapsed={collapsed} />
      <SignOutButton collapsed={collapsed} />
    </aside>
  );
}
