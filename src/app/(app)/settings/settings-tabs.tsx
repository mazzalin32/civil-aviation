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
    <nav role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "shrink-0 border-b-2 border-transparent px-3 py-2.5 text-[13px] font-medium whitespace-nowrap text-text-muted hover:text-text",
              active && "border-primary text-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
