"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import { CalendarPlus, Link2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SlideOver } from "@/components/ui/slide-over";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { RecordOutcomeDialog, type OutcomeEntry } from "./record-outcome-dialog";
import { AddPersonalEntryDialog } from "./add-personal-entry-dialog";
import { getOrCreateIcsToken, deletePersonalEntry } from "./actions";

export type CalendarEvent = {
  id: string;
  type: "entry" | "task";
  title: string;
  start: string;
  end?: string;
  color: string;
  matterId: string | null;
  kind: string;
  status: "OPEN" | "DONE" | "NA";
  assigneeName: string | null;
  courtroom: string | null;
  purpose: string | null;
  isCritical: boolean;
  outcomeType: "PROCEEDED" | "ADJOURNED" | "RULING" | "DIRECTIONS" | null;
  outcomeNote: string | null;
  isPast: boolean;
};

export function CalendarClient({
  events,
  clashes,
  isAdmin,
  lawyers,
  currentLawyerId,
}: {
  events: CalendarEvent[];
  clashes: string[];
  isAdmin: boolean;
  lawyers: { id: string; name: string }[];
  currentLawyerId?: string;
}) {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [recording, setRecording] = useState<OutcomeEntry | null>(null);
  const [icsUrl, setIcsUrl] = useState<string>();
  const [pending, startTransition] = useTransition();

  const fcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: e.status === "DONE" ? "var(--surface-muted)" : e.color,
        borderColor: e.color,
        textColor: e.status === "DONE" ? "var(--text-muted)" : "var(--on-primary)",
      })),
    [events],
  );

  function onEventClick(arg: EventClickArg) {
    const found = events.find((e) => e.id === arg.event.id);
    if (found) setSelected(found);
  }

  function onSubscribe() {
    startTransition(async () => {
      const token = await getOrCreateIcsToken();
      const url = `${window.location.origin}/api/calendar/feed.ics?token=${token}`;
      setIcsUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
    });
  }

  function onDeletePersonal(e: CalendarEvent) {
    if (!window.confirm(`Remove "${e.title}"?`)) return;
    startTransition(async () => {
      await deletePersonalEntry(e.id);
      setSelected(null);
    });
  }

  return (
    <div className="grid gap-4">
      {clashes.length > 0 && (
        <div className="rounded-card border border-danger/40 bg-danger-soft p-3 text-[13px] text-danger">
          {clashes.map((c, i) => (
            <p key={i} className="m-0 flex items-center gap-1.5">
              <TriangleAlert className="size-4 shrink-0" /> {c}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <form className="flex items-center gap-2">
            <Select
              name="lawyer"
              defaultValue={currentLawyerId ?? ""}
              onChange={(e) => {
                const url = new URL(window.location.href);
                if (e.target.value) url.searchParams.set("lawyer", e.target.value);
                else url.searchParams.delete("lawyer");
                window.location.href = url.toString();
              }}
              className="w-auto min-w-[180px]"
            >
              <option value="">All lawyers</option>
              {lawyers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </form>
        )}
        <Button type="button" onClick={onSubscribe} disabled={pending} className="ml-auto">
          <Link2 className="size-4" /> {pending ? "Generating…" : "Subscribe (.ics)"}
        </Button>
        <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
          <CalendarPlus className="size-4" /> Personal entry
        </Button>
      </div>

      {icsUrl && (
        <p className="m-0 rounded-control border border-border bg-surface-muted p-2.5 text-xs break-all text-text-muted">
          Copied to clipboard: {icsUrl}
        </p>
      )}

      <Card className="p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }}
          events={fcEvents}
          eventClick={onEventClick}
          height="auto"
          firstDay={1}
        />
      </Card>

      <SlideOver open={selected !== null} onClose={() => setSelected(null)} title={selected?.type === "task" ? "Task" : "Calendar entry"}>
        {selected && (
          <div className="grid gap-4">
            <div>
              <p className="m-0 text-[15px] font-semibold">{selected.title}</p>
              <p className="m-0 text-[13px] text-text-muted">
                {formatDate(new Date(selected.start), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">{selected.kind}</Badge>
              <Badge tone={selected.status === "OPEN" ? "info" : selected.status === "DONE" ? "success" : "neutral"}>{selected.status}</Badge>
              {selected.isCritical && <Badge tone="warning">Critical</Badge>}
            </div>
            {selected.courtroom && <p className="m-0 text-[13px]">Courtroom: {selected.courtroom}</p>}
            {selected.purpose && <p className="m-0 text-[13px]">Purpose: {selected.purpose}</p>}
            {selected.assigneeName && <p className="m-0 text-[13px]">Assignee: {selected.assigneeName}</p>}
            {selected.outcomeType && (
              <p className="m-0 text-[13px] text-success">
                Outcome: {selected.outcomeType}
                {selected.outcomeNote && ` — ${selected.outcomeNote}`}
              </p>
            )}

            <div className="flex gap-2 border-t border-border pt-4">
              {selected.matterId && (
                <Link href={`/cases/${selected.matterId}`} className={cn(buttonVariants({ variant: "primary" }))}>
                  Open case
                </Link>
              )}
              {selected.type === "entry" &&
                selected.status === "OPEN" &&
                selected.isPast &&
                !["DEADLINE", "PERSONAL"].includes(selected.kind) && (
                  <Button
                    type="button"
                    onClick={() => setRecording({ id: selected.id, title: selected.title, kind: selected.kind, startsAt: selected.start })}
                  >
                    Record outcome
                  </Button>
                )}
              {selected.kind === "PERSONAL" && (
                <Button type="button" onClick={() => onDeletePersonal(selected)} disabled={pending}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        )}
      </SlideOver>

      <AddPersonalEntryDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <RecordOutcomeDialog entry={recording} onClose={() => setRecording(null)} />
    </div>
  );
}
