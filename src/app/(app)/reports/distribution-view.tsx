import { BarList } from "../contracts/bar-list";

export type DistributionRow = {
  status: string;
  categoryId: string;
  categoryName: string;
  forumId: string | null;
  forumName: string | null;
  leadId: string | null;
  leadName: string | null;
};

const STATUS_LABEL: Record<string, string> = { OPEN: "Open", ON_HOLD: "On hold", CLOSURE_REQUESTED: "Closure requested", CLOSED: "Closed" };

function tally<T extends string>(rows: DistributionRow[], keyOf: (r: DistributionRow) => { key: T; label: string } | null) {
  const counts = new Map<T, { label: string; count: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k) continue;
    const existing = counts.get(k.key);
    counts.set(k.key, { label: k.label, count: (existing?.count ?? 0) + 1 });
  }
  return [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
}

export function DistributionView({ rows, query }: { rows: DistributionRow[]; query: string }) {
  const registerHref = (param: string, value: string) => {
    const params = new URLSearchParams(query);
    params.set("tab", "register");
    params.set(param, value);
    return `/reports?${params.toString()}`;
  };

  const byStatus = tally(rows, (r) => ({ key: r.status, label: STATUS_LABEL[r.status] ?? r.status }));
  const byCategory = tally(rows, (r) => ({ key: r.categoryId, label: r.categoryName }));
  const byCourt = tally(rows, (r) => (r.forumId ? { key: r.forumId, label: r.forumName ?? r.forumId } : null));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BarList title="By status" rows={byStatus.map(([status, v]) => ({ label: v.label, count: v.count, href: registerHref("status", status) }))} />
      <BarList title="By category" rows={byCategory.map(([id, v]) => ({ label: v.label, count: v.count, href: registerHref("categoryId", id) }))} />
      <BarList title="By court / forum" rows={byCourt.map(([id, v]) => ({ label: v.label, count: v.count, href: registerHref("forumId", id) }))} />
    </div>
  );
}
