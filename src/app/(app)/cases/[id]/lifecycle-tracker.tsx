"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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

export function LifecycleTracker({
  matterTypeName,
  categoryName,
  stages,
  daysOpen,
}: {
  matterTypeName: string;
  categoryName: string;
  stages: TrackerStage[];
  daysOpen: number;
}) {
  const currentIndex = stages.findIndex((s) => s.status === "current");
  const [openId, setOpenId] = useState<string | null>(stages[currentIndex]?.id ?? null);
  const open = stages.find((s) => s.id === openId);

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-base font-semibold">Case lifecycle</h2>
          <p className="m-0 text-[13px] text-text-muted">
            {matterTypeName} · {categoryName}
          </p>
        </div>
        <span className="text-[13px] text-text-muted">
          Stage {currentIndex >= 0 ? currentIndex + 1 : "—"} of {stages.length} · {daysOpen} day{daysOpen === 1 ? "" : "s"} open
        </span>
      </div>

      <div className="flex items-center overflow-x-auto pb-1">
        {stages.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => setOpenId(s.id === openId ? null : s.id)}
              className="flex min-w-[92px] flex-col items-center gap-1.5 text-center"
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  s.status === "done" && "bg-success text-on-primary",
                  s.status === "current" && "bg-primary text-on-primary motion-safe:animate-pulse",
                  s.status === "future" && "border-2 border-border bg-surface text-text-muted",
                )}
              >
                {s.status === "done" ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("max-w-[100px] text-xs leading-tight", s.status === "current" ? "font-medium text-text" : "text-text-muted")}>
                {s.name}
              </span>
            </button>
            {i < stages.length - 1 && <div className={cn("h-0.5 flex-1", s.status === "done" ? "bg-success" : "bg-border")} />}
          </div>
        ))}
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="m-0 mb-2 text-[13px] font-medium">
            {open.name}
            {open.enteredAt && (
              <span className="ml-2 font-normal text-text-muted">
                {formatDate(new Date(open.enteredAt))} – {open.exitedAt ? formatDate(new Date(open.exitedAt)) : "now"}
              </span>
            )}
          </p>
          {open.events.length === 0 ? (
            <p className="m-0 text-[13px] text-text-muted">No events logged in this stage yet.</p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {open.events.map((e) => (
                <li key={e.id} className="text-[13px]">
                  <span className="text-text-muted">{formatDate(new Date(e.date))}</span> — <span className="font-medium">{e.title}</span>
                  {e.description && <p className="m-0 text-xs text-text-muted">{e.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
