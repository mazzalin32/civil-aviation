import { Check, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressRail({
  steps,
  current,
  furthest,
  saving,
  onSelect,
}: {
  steps: readonly string[];
  current: number;
  furthest: number;
  saving: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <aside aria-label="Intake progress" className="lg:sticky lg:top-6 lg:self-start">
      <p className="m-0 mb-3 px-2 text-[11px] font-semibold tracking-[0.1em] text-text-muted uppercase">Intake progress</p>
      <ol className="m-0 flex list-none gap-1 overflow-x-auto p-0 lg:grid">
        {steps.map((label, i) => {
          const done = i < current;
          const reachable = i <= furthest;
          return (
            <li key={label} className="shrink-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(i)}
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] transition-colors",
                  i === current ? "bg-primary-soft font-medium text-text" : reachable ? "text-text hover:bg-surface-muted" : "cursor-not-allowed text-text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                    i === current && "bg-primary text-on-primary",
                    done && "bg-success-soft text-success",
                    i > current && "border border-border bg-surface text-text-muted",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="whitespace-nowrap">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 hidden rounded-[12px] border border-border bg-surface p-3.5 lg:block">
        <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <Save className="size-3.5" /> {saving ? "Saving draft…" : "Draft autosaved"}
        </p>
      </div>
    </aside>
  );
}
