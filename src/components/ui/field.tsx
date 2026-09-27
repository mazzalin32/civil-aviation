import * as React from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {/* Always reserved, even when empty — a hint/error on only one field in a row otherwise
          leaves that field taller than its neighbour, so the row's bottom edge looks uneven
          right before the next section starts. */}
      <p className={cn("m-0 min-h-[16px] text-xs", error ? "text-danger" : "text-text-muted")} role={error ? "alert" : undefined}>
        {error || hint || " "}
      </p>
    </div>
  );
}
