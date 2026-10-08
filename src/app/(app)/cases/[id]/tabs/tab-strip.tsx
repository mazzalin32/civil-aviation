import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabKey = "timeline" | "documents" | "hearings" | "tasks" | "discussion" | "notes" | "activity";

const TABS: { key: TabKey; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "documents", label: "Legal Documents" },
  { key: "hearings", label: "Deadlines" },
  { key: "tasks", label: "Tasks" },
  { key: "discussion", label: "Discussion" },
  { key: "notes", label: "Notes" },
  { key: "activity", label: "Activity" },
];

export function TabStrip({ matterId, active, counts }: { matterId: string; active: TabKey; counts: Partial<Record<TabKey, number>> }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/cases/${matterId}?tab=${t.key}`}
          role="tab"
          aria-selected={active === t.key}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium",
            active === t.key ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text",
          )}
        >
          {t.label}
          {counts[t.key] != null && (
            <span className={cn("rounded-full px-1.5 text-xs", active === t.key ? "bg-primary-soft text-primary" : "bg-surface-muted text-text-muted")}>
              {counts[t.key]}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
