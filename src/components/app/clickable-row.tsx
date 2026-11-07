"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A table row that opens `href` when clicked anywhere on it (the row highlights on hover, so it has to
 * act clickable). Clicks on a link or button inside the row keep their own behaviour, and the row's own
 * link stays in place for keyboard users, middle-click and "open in new tab".
 */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea")) return;
        if (window.getSelection()?.toString()) return; // the user is selecting text, not opening the row
        router.push(href);
      }}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </tr>
  );
}
