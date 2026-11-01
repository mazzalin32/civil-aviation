import { Card } from "@/components/ui/card";
import { BarList } from "../contracts/bar-list";

export type DurationMatterRow = { categoryName: string; createdAt: Date; closedAt: Date | null };
export type DurationStageRow = { stageName: string; enteredAt: Date; exitedAt: Date | null };

function avgDays<T>(rows: T[], durationOf: (r: T) => number) {
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((sum, r) => sum + durationOf(r), 0) / rows.length);
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function DurationsView({ matterRows, stageRows }: { matterRows: DurationMatterRow[]; stageRows: DurationStageRow[] }) {
  const closed = matterRows.filter((r) => r.closedAt);
  const byCategory = new Map<string, DurationMatterRow[]>();
  for (const r of closed) byCategory.set(r.categoryName, [...(byCategory.get(r.categoryName) ?? []), r]);
  const categoryRows = [...byCategory.entries()]
    .map(([label, rs]) => ({ label, count: avgDays(rs, (r) => (r.closedAt!.getTime() - r.createdAt.getTime()) / MS_PER_DAY), matters: rs.length }))
    .sort((a, b) => b.count - a.count);

  const exitedStages = stageRows.filter((r) => r.exitedAt);
  const byStage = new Map<string, DurationStageRow[]>();
  for (const r of exitedStages) byStage.set(r.stageName, [...(byStage.get(r.stageName) ?? []), r]);
  const stageChartRows = [...byStage.entries()]
    .map(([label, rs]) => ({ label, count: avgDays(rs, (r) => (r.exitedAt!.getTime() - r.enteredAt.getTime()) / MS_PER_DAY), moves: rs.length }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-2">
        <BarList title="Average days to close, by category" rows={categoryRows.map((r) => ({ label: r.label, count: r.count, displayValue: `${r.count}d` }))} />
        <p className="m-0 px-1 text-[12px] text-text-muted">Based on {closed.length} closed matter{closed.length === 1 ? "" : "s"} matching the current filters.</p>
      </div>
      <div className="grid gap-2">
        <BarList title="Average days spent per stage" rows={stageChartRows.map((r) => ({ label: r.label, count: r.count, displayValue: `${r.count}d` }))} />
        <p className="m-0 px-1 text-[12px] text-text-muted">Only stages a matter has already moved past (exited) count toward the average.</p>
      </div>

      {categoryRows.length === 0 && stageChartRows.length === 0 && (
        <Card className="lg:col-span-2 py-10 text-center text-[13px] text-text-muted">No closed matters or completed stages match these filters yet.</Card>
      )}
    </div>
  );
}
