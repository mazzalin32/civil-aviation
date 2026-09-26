"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Plus } from "lucide-react";
import type { CurrentUser } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
        {user.role === "ADMIN" && (
          // Wizard arrives in Phase 4.
          <Link href="/cases/new" className={cn(buttonVariants({ variant: "primary" }))}>
            <Plus />
            <span className="hidden sm:inline">New case</span>
          </Link>
        )}
        <Button size="icon" aria-label="Notifications" title="Notifications and mentions (Phase 8)">
          <Bell className="size-[18px]" strokeWidth={1.8} />
        </Button>
      </div>
    </header>
  );
}
