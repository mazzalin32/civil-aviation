/** Single-hue horizontal bar chart for a magnitude breakdown (counts by category) — a
 *  baseline each bar grows from, direct-labelled counts. One series, so no legend needed. */
export function BarList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="m-0 mb-3 text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="m-0 text-[13px] text-text-muted">No data yet.</p>
      ) : (
        <ul className="m-0 grid list-none gap-0.5 p-0 text-[13px]">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(72px,120px)_minmax(0,1fr)_28px] items-center gap-3 rounded-control px-1 py-1.5">
              <span className="truncate text-text">{r.label}</span>
              <span className="relative h-4 border-l border-border">
                <span className="absolute inset-y-0 left-0 rounded-r bg-primary" style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
