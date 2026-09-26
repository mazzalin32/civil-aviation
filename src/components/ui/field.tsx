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
      {hint && !error && <p className="m-0 text-xs text-text-muted">{hint}</p>}
      {error && (
        <p className="m-0 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
