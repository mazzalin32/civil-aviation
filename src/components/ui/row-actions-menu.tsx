"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type RowAction =
  | { kind: "separator" }
  | {
      kind?: "item";
      label: string;
      icon?: LucideIcon;
      onClick: () => void;
      disabled?: boolean;
      danger?: boolean;
    };

/** The single "⋯" action menu for a table row — replaces a row of separate icon buttons. */
export function RowActionsMenu({ actions, label = "Actions" }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-8 shrink-0 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 min-w-[160px] rounded-control border border-border bg-surface p-1 shadow-pop"
        >
          {actions.map((action, i) => {
            if (action.kind === "separator") return <hr key={i} className="my-1 border-border" />;
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40",
                  action.danger && "text-danger hover:bg-danger-soft",
                )}
              >
                {Icon && <Icon className="size-3.5 shrink-0" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
