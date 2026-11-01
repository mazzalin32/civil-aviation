import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/time";

export type HearingRow = {
  id: string;
  matterId: string;
  matterReference: string;
  matterTitle: string;
  title: string;
  startsAt: Date;
  forumName: string | null;
  courtroom: string | null;
  assigneeName: string | null;
};

export function HearingsView({ rows }: { rows: HearingRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[12px] text-text-muted">
              <th className="px-4 py-3 font-medium">Matter</th>
              <th className="px-4 py-3 font-medium">Hearing</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Court / courtroom</th>
              <th className="px-4 py-3 font-medium">Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3">
                  <Link href={`/cases/${r.matterId}`} className="font-medium text-text hover:text-primary">
                    {r.matterTitle}
                  </Link>
                  <div className="font-mono text-[11px] text-text-muted">{r.matterReference}</div>
                </td>
                <td className="px-4 py-3">{r.title}</td>
                <td className="px-4 py-3 tabular-nums">{formatDate(r.startsAt, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="px-4 py-3">{[r.forumName, r.courtroom].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-3">{r.assigneeName ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                  No upcoming hearings match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
