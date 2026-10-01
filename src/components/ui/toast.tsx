"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * App-wide toasts, top-right. `toast.success("Saved")` works from anywhere on the client; wrap a
 * server action in `withToast(action(...), "Saved")` to get a success or error toast from its result.
 */
type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; message: string };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(kind: Kind, message: string) {
  if (!message) return;
  // The same message twice in a row (a double click, a retry loop) should not stack up.
  if (items.some((t) => t.kind === kind && t.message === message)) return;
  items = [...items, { id: nextId++, kind, message }].slice(-4);
  emit();
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

/**
 * Runs a server action and toasts the outcome: its `error` if it returned one, otherwise
 * `successMessage` (pass `null` to stay silent on success, e.g. for chat messages).
 * Returns the action's own result so existing handling (inline errors, closing dialogs) keeps working.
 */
export async function withToast<T>(action: Promise<T>, successMessage: string | null): Promise<T> {
  try {
    const result = (await action) as unknown;
    const shape = result && typeof result === "object" ? (result as { error?: unknown; ok?: unknown }) : null;
    if (typeof shape?.error === "string" && shape.error) toast.error(shape.error);
    else if (shape?.ok === false) toast.error("That didn't work. Please try again.");
    else if (successMessage) toast.success(successMessage);
    return result as T;
  } catch (err) {
    // Next.js implements redirect()/notFound() by throwing — those are navigation, not failures.
    const digest = (err as { digest?: string } | null)?.digest;
    if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))) throw err;
    toast.error("Something went wrong. Please try again.");
    throw err;
  }
}

const STYLE: Record<Kind, { icon: typeof Info; ring: string; tint: string }> = {
  success: { icon: CheckCircle2, ring: "border-success/40", tint: "text-success" },
  error: { icon: AlertCircle, ring: "border-danger/40", tint: "text-danger" },
  info: { icon: Info, ring: "border-primary/40", tint: "text-primary" },
};

function ToastCard({ item }: { item: ToastItem }) {
  const [visible, setVisible] = useState(false);
  const { icon: Icon, ring, tint } = STYLE[item.kind];
  const duration = item.kind === "error" ? 6500 : 4000;

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => setVisible(false), duration);
    const remove = setTimeout(() => dismiss(item.id), duration + 220);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [item.id, duration]);

  return (
    <div
      role={item.kind === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-2.5 rounded-control border bg-surface px-4 py-3 text-[13px] shadow-pop transition-all duration-200 motion-reduce:transition-none",
        ring,
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
      )}
    >
      <Icon className={cn("mt-px size-4 shrink-0", tint)} strokeWidth={2} />
      <span className="min-w-0 flex-1 break-words">{item.message}</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(() => dismiss(item.id), 200);
        }}
        aria-label="Dismiss"
        className="shrink-0 text-text-muted hover:text-text"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Mount once in the root layout. */
export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {list.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}

/** Backwards-compatible single toast (used by older screens); now routed through the shared stack. */
export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void; durationMs?: number }) {
  useEffect(() => {
    toast.success(message);
    onDismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
