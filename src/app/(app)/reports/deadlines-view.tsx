import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, timeAgo } from "@/lib/time";

export type DeadlineRow = {
  id: string;
  kind: "Task" | "Calendar deadline";
  matterId: string;
  matterReference: string;
  matterTitle: string;
  title: string;
  dueAt: Date;
  assigneeName: string | null;
};

export function DeadlinesView({ rows }: { rows: DeadlineRow[] }) {
  const sorted = [...rows].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[12px] text-text-muted">
              <th className="px-4 py-3 font-medium">Matter</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Was due</th>
              <th className="px-4 py-3 font-medium">Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3">
                  <Link href={`/cases/${r.matterId}`} className="font-medium text-text hover:text-primary">
                    {r.matterTitle}
                  </Link>
                  <div className="font-mono text-[11px] text-text-muted">{r.matterReference}</div>
                </td>
                <td className="px-4 py-3">{r.title}</td>
                <td className="px-4 py-3">
                  <Badge tone="neutral">{r.kind}</Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="text-danger font-medium tabular-nums">{formatDate(r.dueAt)}</span>
                  <div className="text-[11px] text-text-muted">overdue by {timeAgo(r.dueAt)}</div>
                </td>
                <td className="px-4 py-3">{r.assigneeName ?? "—"}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                  No overdue deadlines match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
