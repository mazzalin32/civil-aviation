import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatUGX } from "@/lib/time";
import type { CaseFilters, SortKey } from "../cases/filters";

export type RegisterRow = {
  id: string;
  reference: string;
  title: string;
  categoryName: string;
  matterTypeName: string;
  stageName: string | null;
  status: string;
  priority: string;
  amountClaimed: string | null;
  leadName: string | null;
  createdAt: Date;
  lastActivityAt: Date;
};

const PRIORITY_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" } as const;
const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "title", label: "Matter" },
  { key: null, label: "Category & type" },
  { key: null, label: "Stage" },
  { key: null, label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "value", label: "Value" },
  { key: null, label: "Lead" },
  { key: "createdAt", label: "Opened" },
  { key: "lastActivityAt", label: "Last activity" },
];

export function CaseRegisterView({ rows, filters, sortHref }: { rows: RegisterRow[]; filters: CaseFilters; sortHref: (key: SortKey) => string }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className="w-full min-w-[1040px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-[12px] text-text-muted">
            {COLUMNS.map((col) => (
              <th key={col.label} className="px-4 py-3 font-medium">
                {col.key ? (
                  <Link href={sortHref(col.key)} className="inline-flex items-center gap-1 hover:text-text">
                    {col.label}
                    {filters.sort === col.key && (filters.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </Link>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
              <td className="px-4 py-3">
                <Link href={`/cases/${r.id}`} className="font-medium text-text hover:text-primary">
                  {r.title}
                </Link>
                <div className="font-mono text-[11px] text-text-muted">{r.reference}</div>
              </td>
              <td className="px-4 py-3">
                {r.categoryName} · {r.matterTypeName}
              </td>
              <td className="px-4 py-3">{r.stageName ?? "—"}</td>
              <td className="px-4 py-3">{r.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">
                <Badge tone={PRIORITY_TONE[r.priority as keyof typeof PRIORITY_TONE]}>{r.priority[0] + r.priority.slice(1).toLowerCase()}</Badge>
              </td>
              <td className="px-4 py-3 tabular-nums">{r.amountClaimed ? formatUGX(BigInt(r.amountClaimed)) : "—"}</td>
              <td className="px-4 py-3">{r.leadName ?? "—"}</td>
              <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
              <td className="px-4 py-3">{formatDate(r.lastActivityAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-text-muted">
                No matters match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
