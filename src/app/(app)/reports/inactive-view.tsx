import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/time";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

export type InactiveRow = {
  id: string;
  reference: string;
  title: string;
  status: string;
  leadName: string | null;
  lastActivityAt: Date;
};

const THRESHOLDS = [30, 60, 90] as const;

export function InactiveView({ rows, thresholdDays, query }: { rows: InactiveRow[]; thresholdDays: number; query: string }) {
  const thresholdHref = (days: number) => {
    const params = new URLSearchParams(query);
    params.set("tab", "inactive");
    params.set("inactiveDays", String(days));
    return `/reports?${params.toString()}`;
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[13px]">
        <span className="text-text-muted">No activity in the last</span>
        {THRESHOLDS.map((days) => (
          <Link
            key={days}
            href={thresholdHref(days)}
            className={cn("rounded-control px-2 py-1 font-medium", thresholdDays === days ? "bg-primary-soft text-primary" : "text-text-muted hover:bg-surface-muted hover:text-text")}
          >
            {days} days
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[12px] text-text-muted">
              <th className="px-4 py-3 font-medium">Matter</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
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
                <td className="px-4 py-3">{r.status.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{r.leadName ?? "—"}</td>
                <td className="px-4 py-3">
                  {formatDate(r.lastActivityAt)} <span className="text-text-muted">({daysSince(r.lastActivityAt)}d ago)</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text-muted">
                  No matters have gone quiet this long.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
