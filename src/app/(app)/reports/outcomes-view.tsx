import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDate, formatUGX } from "@/lib/time";
import { BarList } from "../contracts/bar-list";

export type OutcomeRow = {
  id: string;
  reference: string;
  title: string;
  outcomeName: string | null;
  closedAt: Date | null;
  closedByName: string | null;
  amountClaimed: string | null;
};

export function OutcomesView({ rows }: { rows: OutcomeRow[] }) {
  const closed = rows.filter((r) => r.closedAt);
  const byOutcome = new Map<string, number>();
  for (const r of closed) {
    const key = r.outcomeName ?? "Not recorded";
    byOutcome.set(key, (byOutcome.get(key) ?? 0) + 1);
  }
  const chartRows = [...byOutcome.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  return (
    <div className="grid gap-4">
      <BarList title="Closed matters by outcome" rows={chartRows} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-text-muted">
                <th className="px-4 py-3 font-medium">Matter</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Closed</th>
                <th className="px-4 py-3 font-medium">Closed by</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link href={`/cases/${r.id}`} className="font-medium text-text hover:text-primary">
                      {r.title}
                    </Link>
                    <div className="font-mono text-[11px] text-text-muted">{r.reference}</div>
                  </td>
                  <td className="px-4 py-3">{r.outcomeName ?? "Not recorded"}</td>
                  <td className="px-4 py-3 tabular-nums">{r.amountClaimed ? formatUGX(BigInt(r.amountClaimed)) : "—"}</td>
                  <td className="px-4 py-3">{r.closedAt ? formatDate(r.closedAt) : "—"}</td>
                  <td className="px-4 py-3">{r.closedByName ?? "—"}</td>
                </tr>
              ))}
              {closed.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                    No closed matters match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
