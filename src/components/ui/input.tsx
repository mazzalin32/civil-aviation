import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  icon: Icon,
  ...props
}: React.ComponentProps<"input"> & { icon?: React.ComponentType<{ className?: string }> }) {
  if (Icon) {
    return (
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          className={cn(
            "h-10 w-full rounded-none border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      className={cn(
        "h-10 w-full rounded-none border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
