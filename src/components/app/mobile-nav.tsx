"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { Role } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV } from "./nav-config";

/** Navigation for screens narrower than the sidebar breakpoint (tablet / phone). */
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <Button size="icon" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
      </Button>
      {open && (
        <nav className="scrollbar-hidden absolute inset-x-0 top-full grid max-h-[80vh] gap-1.5 overflow-x-hidden overflow-y-auto border-b border-border bg-surface p-3 shadow-pop">
          {NAV[role].map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-control px-3 py-2 font-medium text-text-muted hover:bg-surface-muted hover:text-text",
                  active && "bg-primary-soft text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Link href="/profile" onClick={() => setOpen(false)} className="mt-1.5 rounded-control px-3 py-2 font-medium text-text-muted hover:bg-surface-muted">
            Profile & preferences
          </Link>
        </nav>
      )}
    </div>
  );
}
