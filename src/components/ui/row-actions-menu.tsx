"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const GAP = 4;
const EDGE = 8;

/**
 * The single "⋯" action menu for a table row. The menu is rendered in a portal with fixed
 * coordinates, so a table's overflow can never clip it or let it slide under the section below,
 * and it opens upward when there isn't room underneath (e.g. the last rows of a table).
 */
export function RowActionsMenu({ actions, label = "Actions" }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Measure after the menu renders so we know its real height, then place it below or above the button.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const roomBelow = window.innerHeight - t.bottom - EDGE;
    const roomAbove = t.top - EDGE;
    const openUp = m.height > roomBelow && roomAbove > roomBelow;
    const top = openUp ? Math.max(EDGE, t.top - m.height - GAP) : Math.min(t.bottom + GAP, window.innerHeight - m.height - EDGE);
    const left = Math.min(Math.max(EDGE, t.right - m.width), window.innerWidth - m.width - EDGE);
    setPos({ top, left });
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPos(null);
    };
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    // A fixed menu would drift away from its row if anything scrolls or resizes.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setPos(null);
          setOpen((v) => !v);
        }}
        className="grid size-8 shrink-0 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <MoreVertical className="size-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
            className="z-[60] min-w-[180px] rounded-control border border-border bg-surface p-1 shadow-pop"
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
                    setPos(null);
                    action.onClick();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] whitespace-nowrap text-text hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40",
                    action.danger && "text-danger hover:bg-danger-soft",
                  )}
                >
                  {Icon && <Icon className="size-3.5 shrink-0" />}
                  {action.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
