"use client";

import { useState } from "react";
import { CalendarPlus, GitCommitHorizontal, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/app/avatar";
import { AddEventDialog } from "./add-event-dialog";
import { MoveStageDialog } from "./move-stage-dialog";
import { ReassignDialog } from "./reassign-dialog";
import { ScheduleEntryDialog } from "./schedule-entry-dialog";
import { CaseMenu } from "./case-menu";

const PRIORITY_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" } as const;
const STATUS_LABEL = { OPEN: "Open", ON_HOLD: "On hold", CLOSURE_REQUESTED: "Closure requested", CLOSED: "Closed" } as const;
const STATUS_TONE = { OPEN: "success", ON_HOLD: "warning", CLOSURE_REQUESTED: "info", CLOSED: "neutral" } as const;

export type CaseHeaderData = {
  id: string;
  reference: string;
  title: string;
  status: "OPEN" | "ON_HOLD" | "CLOSURE_REQUESTED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  confidentiality: "NORMAL" | "CONFIDENTIAL" | "HIGHLY_CONFIDENTIAL";
  courtCaseNo: string | null;
  eccmisNo: string | null;
  forumName: string | null;
  team: { id: string; name: string; role: "LEAD" | "SUPPORT" }[];
  isAdmin: boolean;
  eventTypes: { id: string; name: string }[];
  stages: { id: string; name: string; order: number; requiredFields: string[] }[];
  currentStageId: string | null;
  lawyers: { id: string; name: string; title: string | null; workload: number }[];
  forums: { id: string; name: string }[];
};

export function CaseHeader({ data }: { data: CaseHeaderData }) {
  const [dialog, setDialog] = useState<"event" | "moveStage" | "reassign" | "hearing" | "deadline" | null>(null);
  const lead = data.team.find((t) => t.role === "LEAD");
  const support = data.team.filter((t) => t.role === "SUPPORT");

  return (
    <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="m-0 font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">{data.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
          <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
          <Badge tone={PRIORITY_TONE[data.priority]}>{data.priority[0] + data.priority.slice(1).toLowerCase()} priority</Badge>
          {data.confidentiality !== "NORMAL" && (
            <Badge tone="neutral">
              <Lock className="size-3" /> {data.confidentiality === "HIGHLY_CONFIDENTIAL" ? "Highly confidential" : "Confidential"}
            </Badge>
          )}
          <span>{data.reference}</span>
          {data.courtCaseNo && (
            <>
              <span className="text-border">·</span>
              <span>{data.courtCaseNo}</span>
            </>
          )}
          {data.eccmisNo && (
            <>
              <span className="text-border">·</span>
              <span>ECCMIS {data.eccmisNo}</span>
            </>
          )}
          {data.forumName && (
            <>
              <span className="text-border">·</span>
              <span>{data.forumName}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex -space-x-2" title={data.team.map((t) => `${t.name} (${t.role === "LEAD" ? "lead" : "support"})`).join(", ")}>
          {lead && <Avatar name={lead.name} seed={lead.id} className="ring-2 ring-surface" />}
          {support.map((s) => (
            <Avatar key={s.id} name={s.name} seed={s.id} className="ring-2 ring-surface" />
          ))}
        </div>
        <Button type="button" onClick={() => setDialog("event")}>
          <CalendarPlus className="size-4" /> Add event
        </Button>
        <Button type="button" variant="primary" onClick={() => setDialog("moveStage")}>
          <GitCommitHorizontal className="size-4" /> Move stage
        </Button>
        <CaseMenu
          matterId={data.id}
          isAdmin={data.isAdmin}
          status={data.status}
          onReassign={() => setDialog("reassign")}
          onScheduleHearing={() => setDialog("hearing")}
          onAddDeadline={() => setDialog("deadline")}
        />
      </div>

      <AddEventDialog matterId={data.id} eventTypes={data.eventTypes} open={dialog === "event"} onClose={() => setDialog(null)} />
      <MoveStageDialog matterId={data.id} stages={data.stages} currentStageId={data.currentStageId} open={dialog === "moveStage"} onClose={() => setDialog(null)} />
      <ReassignDialog matterId={data.id} lawyers={data.lawyers} currentLeadId={lead?.id} currentSupportIds={support.map((s) => s.id)} open={dialog === "reassign"} onClose={() => setDialog(null)} />
      <ScheduleEntryDialog matterId={data.id} kind="HEARING" forums={data.forums} team={data.team} open={dialog === "hearing"} onClose={() => setDialog(null)} />
      <ScheduleEntryDialog matterId={data.id} kind="DEADLINE" forums={data.forums} team={data.team} open={dialog === "deadline"} onClose={() => setDialog(null)} />
    </section>
  );
}
