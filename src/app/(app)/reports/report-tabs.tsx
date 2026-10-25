import Link from "next/link";
import { cn } from "@/lib/utils";

export type ReportTab = "register" | "outcomes" | "workload";

const TABS: { key: ReportTab; label: string }[] = [
  { key: "register", label: "Case register" },
  { key: "outcomes", label: "Outcomes" },
  { key: "workload", label: "Lawyer workload" },
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
            "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium",
            active === t.key ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
