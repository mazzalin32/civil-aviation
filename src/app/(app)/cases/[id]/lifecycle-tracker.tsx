"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/time";

export type TrackerStage = {
  id: string;
  name: string;
  status: "done" | "current" | "future";
  enteredAt: string | null;
  exitedAt: string | null;
  events: { id: string; title: string; description: string | null; date: string }[];
};

const STATUS_LABEL = { done: "Completed", current: "In progress", future: "Upcoming" } as const;

function daysBetween(from: string, to: number) {
  return Math.max(0, Math.floor((to - new Date(from).getTime()) / 86_400_000));
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function LifecycleTracker({
  matterId,
  matterTypeName,
  categoryName,
  stages,
  daysOpen,
}: {
  matterId: string;
  matterTypeName: string;
  categoryName: string;
  stages: TrackerStage[];
  daysOpen: number;
}) {
  const currentIndex = stages.findIndex((s) => s.status === "current");
  const [openId, setOpenId] = useState<string | null>(stages[currentIndex]?.id ?? null);
  const [now] = useState(() => Date.now());
  const open = stages.find((s) => s.id === openId);
  const openIndex = open ? stages.indexOf(open) : -1;
  const doneCount = stages.filter((s) => s.status === "done").length;
  const progress = stages.length === 0 ? 0 : Math.round((doneCount / stages.length) * 100);

  function describe(stage: TrackerStage) {
    if (stage.status === "future") return "Not reached yet. The case moves here once the current stage is completed.";
    if (!stage.enteredAt) return "Completed — no dates were recorded for this stage.";
    const days = daysBetween(stage.enteredAt, stage.exitedAt ? new Date(stage.exitedAt).getTime() : now);
    return stage.status === "current"
      ? `Current stage — the case has been here for ${plural(days, "day")}.`
      : `Completed — the case spent ${plural(days, "day")} in this stage.`;
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-base font-semibold">Case lifecycle</h2>
          <p className="m-0 text-[13px] text-text-muted">
            {matterTypeName} · {categoryName}
          </p>
        </div>
        <span className="text-[13px] text-text-muted tabular-nums">
          Stage {currentIndex >= 0 ? currentIndex + 1 : "—"} of {stages.length} · {progress}% complete · {plural(daysOpen, "day")} open
        </span>
      </div>

      <div className="flex items-start overflow-x-auto pb-2" role="list" aria-label="Case lifecycle stages">
        {stages.map((s, i) => {
          const selected = s.id === openId;
          return (
            <div key={s.id} role="listitem" className="flex flex-1 items-start last:flex-none">
              <button
                type="button"
                onClick={() => setOpenId(selected ? null : s.id)}
                aria-expanded={selected}
                aria-label={`${s.name} — ${STATUS_LABEL[s.status]}. ${selected ? "Hide" : "Show"} details`}
                title={`${s.name} · ${STATUS_LABEL[s.status]}`}
                className={cn(
                  "group flex min-w-[96px] cursor-pointer flex-col items-center gap-1.5 rounded-control px-2 py-1.5 text-center transition-colors",
                  "hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selected && "bg-primary-soft",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold transition-transform group-hover:scale-110",
                    s.status === "done" && "bg-success text-on-primary",
                    s.status === "current" && "bg-primary text-on-primary motion-safe:animate-pulse",
                    s.status === "future" && "border-2 border-border bg-surface text-text-muted",
                  )}
                >
                  {s.status === "done" ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={cn("max-w-[110px] text-xs leading-tight", s.status === "current" ? "font-semibold text-text" : "text-text-muted", selected && "text-text")}>
                  {s.name}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium tracking-wide uppercase",
                    s.status === "done" && "text-success",
                    s.status === "current" && "text-primary",
                    s.status === "future" && "text-text-muted",
                  )}
                >
                  {STATUS_LABEL[s.status]}
                </span>
              </button>
              {i < stages.length - 1 && <div className={cn("mt-6 h-0.5 min-w-4 flex-1", s.status === "done" ? "bg-success" : "bg-border")} />}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <MousePointerClick className="size-3.5" /> Select a stage to see its dates and events
        </span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Completed</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Current</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border border-border bg-surface" /> Upcoming</span>
      </div>

      {open && (
        <div className="mt-4 rounded-[12px] border border-border bg-surface-muted p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="m-0 text-sm font-semibold">
              Stage {openIndex + 1}: {open.name}
            </p>
            {open.enteredAt && (
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <Clock className="size-3.5" />
                {formatDate(new Date(open.enteredAt))} – {open.exitedAt ? formatDate(new Date(open.exitedAt)) : "now"}
              </span>
            )}
          </div>
          <p className="m-0 mb-3 text-[13px] text-text-muted">{describe(open)}</p>

          {open.status !== "future" &&
            (open.events.length === 0 ? (
              <p className="m-0 text-[13px] text-text-muted">No events logged in this stage yet.</p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {open.events.map((e) => (
                  <li key={e.id} className="text-[13px]">
                    <span className="text-text-muted tabular-nums">{formatDate(new Date(e.date))}</span> — <span className="font-medium">{e.title}</span>
                    {e.description && <p className="m-0 text-xs text-text-muted">{e.description}</p>}
                  </li>
                ))}
              </ul>
            ))}

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-[13px]">
            {open.status !== "current" && currentIndex >= 0 && (
              <button type="button" onClick={() => setOpenId(stages[currentIndex].id)} className="cursor-pointer font-medium text-primary hover:underline">
                Jump to current stage
              </button>
            )}
            <Link href={`/cases/${matterId}?tab=timeline`} className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Open full timeline <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
