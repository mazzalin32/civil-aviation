"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import type { CurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { titleFor } from "./nav-config";
import { SearchTrigger } from "./search-trigger";

export function TopBar({ user }: { user: CurrentUser }) {
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
        <Button size="icon" aria-label="Notifications" title="Notifications and mentions (Phase 8)">
          <Bell className="size-[18px]" strokeWidth={1.8} />
        </Button>
      </div>
    </header>
  );
}
