import Link from "next/link";
import { ArrowUpRight, Clock, Plus } from "lucide-react";
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

function KpiCard({ label, value, hint, href, tone }: DashboardData["kpis"][number]) {
  return (
    <Link
      href={href}
      className="block min-w-0 rounded-card border border-border bg-surface p-5 shadow-card transition-colors hover:border-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-[13px] text-text-muted">{label}</p>
        <ArrowUpRight className="size-4 text-text-muted" strokeWidth={1.8} />
      </div>
      <p className="mt-3 mb-1 font-serif text-[32px] leading-none font-semibold tabular-nums">{String(value).padStart(2, "0")}</p>
      <p className={cn("m-0 text-[12px]", tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-text-muted")}>
        {hint}
      </p>
    </Link>
  );
}

function StageBars({ stages }: { stages: DashboardData["stages"] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  if (stages.length === 0) {
    return <p className="m-0 px-6 pb-5 text-[13px] text-text-muted">No open matters to chart yet.</p>;
  }
  return (
    <div className="flex h-[220px] items-end gap-2 overflow-x-auto px-6 pt-3 pb-5">
      {stages.map((s) => (
        <Link key={s.name} href={`/cases?stage=${encodeURIComponent(s.name)}`} className="group flex min-w-[48px] flex-1 flex-col items-center gap-2">
          <span className="text-[11px] tabular-nums text-text-muted">{s.count}</span>
          <span
            className="w-full max-w-[44px] rounded-t-md bg-primary transition-opacity group-hover:opacity-80"
            style={{ height: `${Math.max(8, (s.count / max) * 140)}px` }}
          />
          <span className="w-full truncate text-center text-[11px] text-text-muted" title={s.name}>
            {s.name}
          </span>
        </Link>
      ))}
    </div>
  );
}

function RiskDonut({ risk }: { risk: DashboardData["risk"] }) {
  const total = risk.reduce((n, s) => n + s.count, 0);
  let cursor = 0;
  const stops: string[] = [];
  for (const slice of risk) {
    const pct = total === 0 ? 0 : (slice.count / total) * 100;
    stops.push(`${RISK_COLOR[slice.key]} ${cursor}% ${cursor + pct}%`);
    cursor += pct;
  }
  return (
    <div className="flex flex-wrap items-center gap-6 px-6 pt-3 pb-5">
      <div
        className="relative size-[140px] shrink-0 rounded-full"
        style={{ background: total === 0 ? "var(--neutral-soft)" : `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="absolute inset-[28px] grid place-items-center rounded-full bg-surface">
          <div className="text-center">
            <p className="m-0 font-serif text-[22px] leading-none font-semibold tabular-nums">{total}</p>
            <p className="m-0 mt-1 text-[11px] text-text-muted">Total matters</p>
          </div>
        </div>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 text-[13px]">
        {risk.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: RISK_COLOR[s.key] }} />
            <span className="w-16 text-text-muted">{s.key}</span>
            <span className="tabular-nums font-medium">{s.count}</span>
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
              <Plus className="size-4" /> New case
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
            <div>
              <CardTitle>Matters by stage</CardTitle>
              <p className="m-0 mt-0.5 text-[12px] text-text-muted">Current portfolio distribution</p>
            </div>
            <Link href={data.isAdmin ? "/reports" : "/cases"} className="text-[13px] font-medium text-primary hover:underline">
              View report
            </Link>
          </CardHeader>
          <StageBars stages={data.stages} />
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>Matters by risk</CardTitle>
              <p className="m-0 mt-0.5 text-[12px] text-text-muted">Priority across open matters</p>
            </div>
          </CardHeader>
          <RiskDonut risk={data.risk} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="justify-between">
            <div>
              <CardTitle>Cases needing attention</CardTitle>
              <p className="m-0 mt-0.5 text-[12px] text-text-muted">High-risk and recently active matters</p>
            </div>
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
                          <span className="font-serif text-lg leading-none font-semibold tabular-nums">
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
            <div>
              <CardTitle>Deadlines requiring action</CardTitle>
              <p className="m-0 mt-0.5 text-[12px] text-text-muted">Prioritised by urgency</p>
            </div>
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
