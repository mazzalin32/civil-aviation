import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  icon: Icon,
  children,
  ...props
}: React.ComponentProps<"select"> & { icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />}
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-none border border-border bg-surface pr-9 text-sm text-text",
          Icon ? "pl-9" : "pl-3",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
    </div>
  );
}
