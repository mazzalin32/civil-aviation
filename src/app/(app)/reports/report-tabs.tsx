import Link from "next/link";
import { cn } from "@/lib/utils";

export type ReportTab = "register" | "distribution" | "outcomes" | "durations" | "financial" | "workload" | "hearings" | "deadlines" | "inactive";

const TABS: { key: ReportTab; label: string }[] = [
  { key: "register", label: "Case register" },
  { key: "distribution", label: "By status / category / court" },
  { key: "outcomes", label: "Outcomes" },
  { key: "durations", label: "Average duration" },
  { key: "financial", label: "Financial exposure" },
  { key: "workload", label: "Lawyer workload" },
  { key: "hearings", label: "Upcoming hearings" },
  { key: "deadlines", label: "Overdue deadlines" },
  { key: "inactive", label: "Inactive cases" },
];

export function ReportTabs({ active, query }: { active: ReportTab; query: string }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/reports?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(query)), tab: t.key }).toString()}`}
          role="tab"
          aria-selected={active === t.key}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap",
            active === t.key ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
