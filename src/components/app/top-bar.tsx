"use client";

import { usePathname } from "next/navigation";
import type { CurrentUser } from "@/lib/session";
import { MobileNav } from "./mobile-nav";
import { titleFor } from "./nav-config";
import { SearchTrigger } from "./search-trigger";
import { NotificationBell } from "./notification-bell";

export function TopBar({ user, unreadNotifications }: { user: CurrentUser; unreadNotifications: number }) {
  const pathname = usePathname();
  const title = titleFor(pathname, user.role);

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-8">
      <MobileNav role={user.role} />
      <div className="min-w-0 truncate text-[13px] text-text-muted">{title}</div>
      <div className="ml-auto flex items-center gap-3">
        <SearchTrigger />
        {/* "New case" lives on the Cases page itself and the sidebar's quick-add — having it
            here too, on every page, was one add entry point too many. */}
        <NotificationBell initialUnreadCount={unreadNotifications} />
      </div>
    </header>
  );
}
