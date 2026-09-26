"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";

const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Global search entry point. The ⌘K / Ctrl K palette itself arrives with search. */
export function SearchTrigger() {
  // Server render assumes Windows (UCAA's machines); the client corrects it for Macs.
  const mac = useSyncExternalStore(
    () => () => {},
    isMac,
    () => false,
  );

  return (
    <button
      type="button"
      className="hidden w-[220px] items-center gap-2 rounded-control border border-transparent bg-surface-muted px-3 py-2 text-left text-text-muted md:flex"
    >
      <Search className="size-4" />
      <span className="flex-1">Search</span>
      <kbd className="rounded-md border border-border bg-surface px-1.5 font-sans text-xs">{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );
}
