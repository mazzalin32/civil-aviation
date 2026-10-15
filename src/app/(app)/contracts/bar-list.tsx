/** Single-hue horizontal bar list for a magnitude breakdown (counts by category) — thin bars,
 * rounded ends, direct-labelled counts. One series, so no legend/multi-hue palette needed. */
export function BarList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="m-0 mb-3 text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="m-0 text-[13px] text-text-muted">No data yet.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2.5 p-0 text-[13px]">
          {rows.map((r) => (
            <li key={r.label} className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-text-muted">{r.label}</span>
                <span className="shrink-0 font-medium tabular-nums">{r.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
