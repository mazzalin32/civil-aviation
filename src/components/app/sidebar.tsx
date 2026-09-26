"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  FileCheck2,
  LayoutGrid,
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

export function Sidebar({ user, devSwitch }: { user: CurrentUser; devSwitch?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Main navigation"
      className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-1 border-r border-border bg-surface px-3.5 py-5 lg:flex"
    >
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div aria-hidden className="grid size-[34px] place-items-center rounded-control bg-primary text-on-primary">
          <Scale className="size-[18px]" />
        </div>
        <div className="leading-tight">
          <b className="block text-sm font-semibold">CAA Legal</b>
          <small className="text-xs text-text-muted">Uganda Civil Aviation Authority</small>
        </div>
      </div>

      <nav className="grid gap-0.5">
        {NAV[user.role].map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-control px-2.5 py-2 font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text",
                active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />
      {devSwitch}
      <UserCard user={user} />
    </aside>
  );
}
