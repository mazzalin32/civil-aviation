"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small, self-dismissing confirmation — not a full-width banner that pushes the page down. */
export function Toast({ message, onDismiss, durationMs = 4000 }: { message: string; onDismiss: () => void; durationMs?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => setVisible(false), durationMs);
    const removeTimer = setTimeout(onDismiss, durationMs + 200);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[76px] z-50 flex justify-center px-4 sm:justify-center sm:px-0">
      <div
        role="status"
        className={cn(
          "pointer-events-auto flex items-center gap-2.5 rounded-control border border-success/40 bg-surface px-4 py-2.5 text-[13px] shadow-pop transition-all duration-200",
          visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
        )}
      >
        <CheckCircle2 className="size-4 shrink-0 text-success" />
        <span>{message}</span>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 200);
          }}
          aria-label="Dismiss"
          className="ml-1 text-text-muted hover:text-text"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
