"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/matter-types", label: "Matter types & lifecycles" },
  { href: "/settings/forums", label: "Courts & forums" },
  { href: "/settings/types", label: "Event & document types" },
  { href: "/settings/outcomes", label: "Outcomes" },
  { href: "/settings/reminders", label: "Reminder schedules" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:grid lg:overflow-visible">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-control px-3 py-2 text-[13px] font-medium whitespace-nowrap text-text-muted hover:bg-surface-muted hover:text-text",
              active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
