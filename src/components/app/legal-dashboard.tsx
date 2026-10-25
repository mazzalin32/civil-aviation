import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard";

const PRIORITY_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" } as const;
const RISK_COLOR: Record<DashboardData["risk"][number]["key"], string> = {
  High: "var(--danger)",
  Medium: "var(--warning)",
  Low: "var(--success)",
};

/** Risk levels are spelled out in full in the interface (correct-terms §1) — the bare
 *  "High"/"Medium"/"Low" keys stay as the data. */
const RISK_LABEL: Record<DashboardData["risk"][number]["key"], string> = {
  High: "High Risk",
  Medium: "Medium Risk",
  Low: "Low Risk",
};

function KpiCard({ label, value, href, tone }: DashboardData["kpis"][number]) {
  return (
    <Link href={href} className="block min-w-0 rounded-card border border-border bg-surface p-6 shadow-card transition-shadow hover:shadow-pop">
      <p className="m-0 text-[13.5px] text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-2.5 mb-0 text-[36px] leading-none font-semibold tabular-nums",
          tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-text",
        )}
      >
        {value}
      </p>
    </Link>
  );
}

/** Horizontal bar chart — single-hue magnitude comparison across stages (one series,
 *  so no legend; direct value label at the tip per dataviz mark spec). */
function StageBars({ stages }: { stages: DashboardData["stages"] }) {
  if (stages.length === 0) {
    return <p className="m-0 px-6 pt-3 pb-5 text-[13px] text-text-muted">No open matters to chart yet.</p>;
  }
  const rows = [...stages].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.map((s) => s.count));
  return (
    <ul className="m-0 grid max-h-[300px] list-none gap-0.5 overflow-y-auto px-3 pt-2 pb-4">
      {rows.map((s) => (
        <li key={s.name}>
          <Link
            href={`/cases?stage=${encodeURIComponent(s.name)}`}
            title={`${s.name}: ${s.count} matter${s.count === 1 ? "" : "s"}`}
            className="group grid grid-cols-[minmax(92px,150px)_minmax(0,1fr)_32px] items-center gap-3 rounded-control px-3 py-2 hover:bg-surface-muted"
          >
            <span className="truncate text-[13px] text-text">{s.name}</span>
            <span className="relative h-4 border-l border-border">
              <span
                className="absolute inset-y-0 left-0 rounded-r bg-primary transition-[width]"
                style={{ width: `${Math.max(3, (s.count / max) * 100)}%` }}
              />
            </span>
            <span className="text-right text-[13px] font-semibold tabular-nums">{s.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Part-to-whole across three risk levels: one thick stacked bar with surface-color
 *  gaps between segments (dataviz mark spec), status colors already reserved by the
 *  design system, legend carries identity + the exact count since 3 segments is too
 *  tight to safely inline-label without clipping. */
function RiskBreakdown({ risk }: { risk: DashboardData["risk"] }) {
  const total = risk.reduce((n, s) => n + s.count, 0);
  const segments = risk.filter((s) => s.count > 0);
  return (
    <div className="px-6 pt-3 pb-5">
      <p className="m-0 text-[32px] leading-none font-semibold tabular-nums">{total}</p>
      <p className="m-0 mt-1 mb-5 text-[12px] text-text-muted">Active Matters</p>
      <div className="flex h-5 gap-[2px]" role="img" aria-label={risk.map((s) => `${RISK_LABEL[s.key]} ${s.count}`).join(", ")}>
        {total === 0 ? (
          <span className="h-full w-full rounded-full bg-surface-muted" />
        ) : (
          segments.map((s, i) => (
            <span
              key={s.key}
              title={`${RISK_LABEL[s.key]}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
              className={cn(i === 0 && "rounded-l-full", i === segments.length - 1 && "rounded-r-full")}
              style={{ width: `${(s.count / total) * 100}%`, background: RISK_COLOR[s.key] }}
            />
          ))
        )}
      </div>
      <ul className="m-0 mt-5 grid list-none gap-2.5 p-0 text-[13px]">
        {risk.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: RISK_COLOR[s.key] }} />
            <span className="flex-1 text-text-muted">{RISK_LABEL[s.key]}</span>
            <span className="font-semibold tabular-nums">{s.count}</span>
            <span className="w-10 text-right text-[12px] text-text-muted tabular-nums">{total === 0 ? "0%" : `${Math.round((s.count / total) * 100)}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegalDashboard({ data }: { data: DashboardData }) {
  return (
    <>
      <p className="m-0 mb-1 text-[12px] font-medium tracking-[0.04em] text-text-muted uppercase">{data.dateLabel}</p>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <h1 className="m-0 min-w-0 font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">{data.greeting}</h1>
        {data.isAdmin && (
          <div className="ml-auto">
            <Link href="/cases/new" className={buttonVariants({ variant: "primary" })}>
              <Plus className="size-4" /> New Matter
            </Link>
          </div>
        )}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <CardHeader className="justify-between">
            <CardTitle>Matters by Stage</CardTitle>
            <Link href={data.isAdmin ? "/reports" : "/cases"} className="text-[13px] font-medium text-primary hover:underline">
              View report
            </Link>
          </CardHeader>
          <StageBars stages={data.stages} />
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Matters by Risk</CardTitle>
          </CardHeader>
          <RiskBreakdown risk={data.risk} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="justify-between">
            <CardTitle>Requires Action</CardTitle>
            <Link href="/cases" className="text-[13px] font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {data.attention.length === 0 ? (
              <p className="m-0 text-[13px] text-text-muted">No open matters yet.</p>
            ) : (
              <ul className="m-0 grid grid-cols-[minmax(0,1fr)] list-none gap-1 p-0">
                {data.attention.map((row) => {
                  const d = new Date(row.lastActivityAt);
                  return (
                    <li key={row.id} className="min-w-0">
                      <Link
                        href={`/cases/${row.id}`}
                        className="flex items-center gap-3 rounded-control px-1 py-2.5 hover:bg-surface-muted"
                      >
                        <span className="grid w-10 shrink-0 text-center">
                          <span className="text-[10px] font-medium tracking-wide text-text-muted uppercase">
                            {formatDate(d, { month: "short" })}
                          </span>
                          <span className="text-lg leading-none font-semibold tabular-nums">
                            {formatDate(d, { day: "numeric" })}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{row.title}</span>
                          <span className="block truncate text-[12px] text-text-muted">
                            {row.reference}
                            {row.stageName ? ` · ${row.stageName}` : ""}
                          </span>
                        </span>
                        <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority[0] + row.priority.slice(1).toLowerCase()}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="justify-between">
            <CardTitle>Deadlines</CardTitle>
            {data.overdueDeadlineCount > 0 && <Badge tone="danger">{data.overdueDeadlineCount} overdue</Badge>}
          </CardHeader>
          <CardContent>
            {data.deadlines.length === 0 ? (
              <p className="m-0 text-[13px] text-text-muted">No open deadlines.</p>
            ) : (
              <ul className="m-0 grid grid-cols-[minmax(0,1fr)] list-none gap-1 p-0">
                {data.deadlines.map((row) => (
                  <li key={row.id} className="min-w-0">
                    <Link href={`/cases/${row.matterId}?tab=hearings`} className="flex items-center gap-3 rounded-control px-1 py-2.5 hover:bg-surface-muted">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning-soft text-warning">
                        <Clock className="size-4" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{row.title}</span>
                        <span className="block truncate text-[12px] text-text-muted">{row.reference}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={cn("block text-[12px] font-medium", row.overdue ? "text-danger" : "text-text")}>
                          {row.overdue ? "Overdue" : formatDate(new Date(row.dueAt))}
                        </span>
                        <Badge tone={PRIORITY_TONE[row.priority]} className="mt-1">
                          {row.priority[0] + row.priority.slice(1).toLowerCase()}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
