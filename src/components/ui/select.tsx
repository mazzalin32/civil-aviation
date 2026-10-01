"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Icon = React.ComponentType<{ className?: string }>;
type Opt = { value: string; label: string; disabled?: boolean };

/** Lists up to this many options stay a plain native select; longer ones get a search box. */
const SEARCH_THRESHOLD = 7;

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Flattens <option> children — including fragments, arrays and simple wrapper components like <Options/>. */
function flatten(children: React.ReactNode, out: Opt[] = []): Opt[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean }>(child)) return;
    if (child.type === "option") {
      const label = textOf(child.props.children);
      out.push({ value: child.props.value !== undefined ? String(child.props.value) : label, label, disabled: child.props.disabled });
    } else if (child.type === React.Fragment) {
      flatten(child.props.children, out);
    } else if (typeof child.type === "function") {
      try {
        flatten((child.type as (p: unknown) => React.ReactNode)(child.props), out);
      } catch {
        // A component that needs hooks/context can't be expanded here — its options just won't be searchable.
      }
    }
  });
  return out;
}

const triggerClass = (hasIcon: boolean, className?: string) =>
  cn(
    "h-10 w-full appearance-none rounded-control border border-border bg-surface pr-9 text-sm text-text",
    hasIcon ? "pl-9" : "pl-3",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );

export function Select({ icon: Icon, children, ...props }: React.ComponentProps<"select"> & { icon?: Icon }) {
  const options = React.useMemo(() => flatten(children), [children]);
  if (options.length > SEARCH_THRESHOLD) return <SearchableSelect icon={Icon} options={options} {...props} />;
  return <NativeSelect icon={Icon} {...props}>{children}</NativeSelect>;
}

function NativeSelect({ className, icon: Icon, children, ...props }: React.ComponentProps<"select"> & { icon?: Icon }) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />}
      <select className={triggerClass(Boolean(Icon), className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
    </div>
  );
}

function SearchableSelect({
  className,
  icon: Icon,
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled,
  "aria-label": ariaLabel,
}: React.ComponentProps<"select"> & { icon?: Icon; options: Opt[] }) {
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(String(defaultValue ?? ""));
  const current = controlled ? String(value) : inner;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const listId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const hiddenRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === current);
  // The empty option ("Choose a category…") acts as the placeholder, so it isn't offered while searching.
  const placeholder = options.find((o) => o.value === "")?.label ?? "Select an option";
  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.value !== "" && o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function place() {
    const t = triggerRef.current?.getBoundingClientRect();
    if (!t) return;
    const below = window.innerHeight - t.bottom - 12;
    const above = t.top - 12;
    const up = below < 240 && above > below;
    const maxHeight = Math.max(160, Math.min(320, up ? above : below));
    setPos({ top: up ? Math.max(8, t.top - maxHeight - 4) : t.bottom + 4, left: t.left, width: t.width, maxHeight });
  }

  function openMenu() {
    if (disabled) return;
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(opt: Opt) {
    if (opt.disabled) return;
    if (!controlled) setInner(opt.value);
    // Set the DOM value first so a handler that submits the surrounding form reads the new value.
    if (hiddenRef.current) hiddenRef.current.value = opt.value;
    onChange?.({ target: hiddenRef.current, currentTarget: hiddenRef.current } as unknown as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    triggerRef.current?.focus();
  }

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    const reposition = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return; // scrolling the option list itself
      place();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  React.useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input ref={hiddenRef} type="hidden" name={name} value={current} readOnly />
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
          }
        }}
        className={cn(triggerClass(Boolean(Icon), className), "truncate text-left", !selected?.value && "text-text-muted")}
      >
        {selected && selected.value !== "" ? selected.label : placeholder}
      </button>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
            className="z-[70] flex flex-col overflow-hidden rounded-control border border-border bg-surface shadow-pop"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 shrink-0 text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKey}
                placeholder="Search…"
                aria-label="Search options"
                className="h-10 w-full bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <ul ref={listRef} id={listId} role="listbox" className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1">
              {shown.length === 0 ? (
                <li className="px-2.5 py-2 text-[13px] text-text-muted">No matches</li>
              ) : (
                shown.map((o, i) => (
                  <li
                    key={`${o.value}-${i}`}
                    role="option"
                    aria-selected={o.value === current}
                    aria-disabled={o.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
                      i === active && "bg-surface-muted",
                      o.value === current && "font-medium",
                      o.disabled && "pointer-events-none opacity-40",
                      o.value === "" && "text-text-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label || placeholder}</span>
                    {o.value === current && o.value !== "" && <Check className="size-3.5 shrink-0 text-primary" />}
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
