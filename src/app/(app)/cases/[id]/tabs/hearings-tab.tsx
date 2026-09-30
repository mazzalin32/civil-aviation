"use client";

import { useState } from "react";
import { CalendarClock, Check, Clock, Gavel, Handshake, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/time";
import { RecordOutcomeDialog, type OutcomeEntry } from "@/app/(app)/calendar/record-outcome-dialog";

const KIND_ICON = { HEARING: Gavel, MENTION: CalendarClock, MEDIATION: Handshake, JUDGMENT: Scale, DEADLINE: Clock } as const;
const KIND_LABEL = { HEARING: "Hearing", MENTION: "Mention", MEDIATION: "Mediation", JUDGMENT: "Judgment", DEADLINE: "Deadline" } as const;
const OUTCOME_LABEL = { PROCEEDED: "Proceeded", ADJOURNED: "Adjourned", RULING: "Ruling delivered", DIRECTIONS: "Directions given" } as const;

export type HearingRow = {
  id: string;
  kind: "HEARING" | "MENTION" | "MEDIATION" | "JUDGMENT" | "DEADLINE";
  title: string;
  startsAt: string;
  status: "OPEN" | "DONE" | "NA";
  outcomeType: "PROCEEDED" | "ADJOURNED" | "RULING" | "DIRECTIONS" | null;
  outcomeNote: string | null;
  isCritical: boolean;
  courtroom: string | null;
  purpose: string | null;
};

export function HearingsTab({ entries, canMutate }: { entries: HearingRow[]; canMutate: boolean }) {
  const [recording, setRecording] = useState<OutcomeEntry | null>(null);
  // A snapshot taken once when this component first mounts is fine here — it only needs to
  // be "roughly now" for the overdue/needs-outcome check below, not stable across re-renders.
  const [now] = useState(() => Date.now());

  if (entries.length === 0) {
    return <p className="m-0 text-[13px] text-text-muted">No deadlines scheduled yet.</p>;
  }

  return (
    <div className="grid gap-2">
      {entries.map((e) => {
        const Icon = KIND_ICON[e.kind];
        const isPast = new Date(e.startsAt).getTime() < now;
        const needsOutcome = e.status === "OPEN" && isPast && e.kind !== "DEADLINE";
        const overdue = e.status === "OPEN" && e.kind === "DEADLINE" && isPast;
        return (
          <div key={e.id} className="flex items-center gap-3 rounded-card border border-border p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-text-muted">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-[13.5px] font-semibold">{e.title}</b>
                <Badge tone="neutral">{KIND_LABEL[e.kind]}</Badge>
                {e.isCritical && <Badge tone={overdue ? "danger" : "warning"}>Critical</Badge>}
                {overdue && <Badge tone="danger">Overdue</Badge>}
              </div>
              <p className="m-0 text-xs text-text-muted">
                {formatDate(new Date(e.startsAt), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                {e.courtroom && ` · ${e.courtroom}`}
                {e.purpose && ` · ${e.purpose}`}
              </p>
              {e.status !== "OPEN" && e.outcomeType && (
                <p className="m-0 mt-1 flex items-center gap-1 text-xs text-success">
                  <Check className="size-3" /> {OUTCOME_LABEL[e.outcomeType]}
                  {e.outcomeNote && ` — ${e.outcomeNote}`}
                </p>
              )}
            </div>
            {canMutate && needsOutcome && (
              <Button type="button" size="sm" variant="primary" onClick={() => setRecording({ id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt })}>
                Record outcome
              </Button>
            )}
          </div>
        );
      })}

      <RecordOutcomeDialog entry={recording} onClose={() => setRecording(null)} />
    </div>
  );
}
