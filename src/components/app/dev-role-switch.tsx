import { switchDevRole } from "@/app/dev-actions";
import type { Role } from "@/lib/session";
import { cn } from "@/lib/utils";

/** Dev-only preview of both shells until login exists (Phase 1 removes it). */
export function DevRoleSwitch({ role }: { role: Role }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <form action={switchDevRole} className="mb-2 grid gap-1.5 rounded-xl border border-dashed border-border p-2.5">
      <span className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Dev preview</span>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-0.5">
        {(["LAWYER", "ADMIN"] as const).map((r) => (
          <button
            key={r}
            name="role"
            value={r}
            aria-pressed={role === r}
            className={cn(
              "rounded-sm py-1 text-xs font-medium text-text-muted",
              role === r && "bg-surface text-text shadow-card",
            )}
          >
            {r === "ADMIN" ? "Admin" : "Lawyer"}
          </button>
        ))}
      </div>
    </form>
  );
}
