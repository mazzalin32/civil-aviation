"use client";

import { useState } from "react";
import { FileText, Gavel, Scale, Mail, Handshake, FileCheck, FilePlus, ArrowRightLeft, GitCommitHorizontal, UserCog, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/time";

const ICONS: Record<string, typeof FileText> = {
  Filing: FileText,
  Correspondence: Mail,
  Ruling: FileCheck,
  Hearing: Gavel,
  "Mediation session": Handshake,
  "Judgment / order": Scale,
  "Application filed": FilePlus,
  Directions: ArrowRightLeft,
  "Stage change": GitCommitHorizontal,
  "Assignment change": UserCog,
};

export type TimelineEvent = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  typeName: string;
  createdByName: string;
};

export function TimelineTab({ events, typeNames }: { events: TimelineEvent[]; typeNames: string[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  const visible = filter ? events.filter((e) => e.typeName === filter) : events;

  if (events.length === 0) {
    return <p className="m-0 text-[13px] text-text-muted">Nothing on the timeline yet — events appear here as the case moves forward.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={cn("rounded-full px-3 py-1 text-xs font-medium", filter === null ? "bg-primary text-on-primary" : "bg-surface-muted text-text-muted hover:text-text")}
        >
          All
        </button>
        {typeNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setFilter(name)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium", filter === name ? "bg-primary text-on-primary" : "bg-surface-muted text-text-muted hover:text-text")}
          >
            {name}
          </button>
        ))}
      </div>

      <ol className="m-0 grid list-none gap-4 p-0">
        {visible.map((e) => {
          const Icon = ICONS[e.typeName] ?? CalendarClock;
          return (
            <li key={e.id} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-text-muted">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 border-b border-border pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[13.5px] font-semibold">{e.title}</b>
                  <Badge tone="neutral">{e.typeName}</Badge>
                  <time className="ml-auto text-xs text-text-muted">{formatDate(new Date(e.date))}</time>
                </div>
                {e.description && <p className="m-0 mt-1 text-[13px] text-text-muted">{e.description}</p>}
                <p className="m-0 mt-1 text-xs text-text-muted">Logged by {e.createdByName}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
