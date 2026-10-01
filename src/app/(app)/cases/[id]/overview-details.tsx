import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, FileInput, Gavel, Landmark, PauseCircle, Scale, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Everything captured at onboarding (the 9-step intake), shaped for display. Dates are ISO strings. */
export type Intake = {
  description: string | null;
  reportedAt: string | null;
  reportedBy: string | null;
  reportMethod: string | null;
  positionLabel: string;
  otherParty: { name: string; type: string | null; contact: string | null; address: string | null } | null;
  otherParties: { name: string; role: string | null; organisation: string | null }[];
  serviceDirection: string | null;
  processNature: string | null;
  issuedAt: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  recipientName: string | null;
  responseDeadline: { dueAt: string; status: string } | null;
  forumName: string | null;
  courtStation: string | null;
  courtCaseNo: string | null;
  filedAt: string | null;
  jurisdiction: string | null;
  judge: string | null;
  eccmisNo: string | null;
  representationStatus: string | null;
  leadName: string | null;
  supportNames: string[];
  externalCounselName: string | null;
  externalCounselContact: string | null;
};

export type StatusInfo = {
  status: "OPEN" | "ON_HOLD" | "CLOSURE_REQUESTED" | "CLOSED";
  priorityLabel: string;
  confidentialityLabel: string;
  stageName: string | null;
  stageIndex: number;
  stageTotal: number;
  daysOpen: number;
  nextDeadline: { title: string; dueAt: string } | null;
};

const DAY = 86_400_000;
const day = (iso: string | null) => (iso ? formatDate(new Date(iso)) : null);
const dateOnly = (iso: string | null) => (iso ? formatDate(new Date(iso), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);

/** One plain-language sentence about where the case stands, with a tone so risk is visible at a glance. */
function statusSentence(s: StatusInfo, now: number): { tone: "success" | "warning" | "danger" | "neutral" | "info"; label: string; text: string } {
  if (s.status === "CLOSED") return { tone: "neutral", label: "Closed", text: "This matter is closed. Documents and history remain available." };
  if (s.status === "CLOSURE_REQUESTED") return { tone: "warning", label: "Closure requested", text: "A lawyer has asked to close this matter. It is waiting for the Head of Legal to approve." };
  const stage = s.stageName ? `${s.stageName}${s.stageIndex > 0 ? ` (stage ${s.stageIndex} of ${s.stageTotal})` : ""}` : "no stage set yet";
  if (s.status === "ON_HOLD") return { tone: "neutral", label: "On hold", text: `Work is paused at ${stage}.` };

  const next = s.nextDeadline;
  if (next) {
    const days = Math.ceil((new Date(next.dueAt).getTime() - now) / DAY);
    if (days < 0) return { tone: "danger", label: "Action needed", text: `“${next.title}” was due ${day(next.dueAt)} — overdue by ${-days} day${days === -1 ? "" : "s"}. Currently at ${stage}.` };
    if (days <= 7) return { tone: "warning", label: "Due soon", text: `“${next.title}” is due ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`} (${day(next.dueAt)}). Currently at ${stage}.` };
    return { tone: "success", label: "On track", text: `Currently at ${stage}. Next deadline “${next.title}” is in ${days} days (${day(next.dueAt)}).` };
  }
  return { tone: "success", label: "On track", text: `Currently at ${stage}. No open deadlines.` };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-[13px]">
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

function Group({ icon: Icon, title, children, empty }: { icon: typeof Gavel; title: string; children: ReactNode; empty?: boolean }) {
  if (empty) return null;
  return (
    <section className="min-w-0 rounded-[12px] border border-border p-4">
      <h3 className="m-0 mb-3 flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-text-muted uppercase">
        <Icon className="size-3.5" strokeWidth={1.8} /> {title}
      </h3>
      <dl className="m-0 grid gap-2.5">{children}</dl>
    </section>
  );
}

export function StatusBanner({ info, now }: { info: StatusInfo; now: number }) {
  const s = statusSentence(info, now);
  const Icon = s.tone === "danger" ? AlertTriangle : s.tone === "warning" ? CalendarClock : info.status === "ON_HOLD" ? PauseCircle : CheckCircle2;
  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-3 rounded-[12px] border px-4 py-3",
        s.tone === "danger" && "border-danger/30 bg-danger-soft",
        s.tone === "warning" && "border-warning/30 bg-warning-soft",
        s.tone === "success" && "border-success/30 bg-success-soft",
        (s.tone === "neutral" || s.tone === "info") && "border-border bg-surface-muted",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", s.tone === "danger" && "text-danger", s.tone === "warning" && "text-warning", s.tone === "success" && "text-success", s.tone === "neutral" && "text-text-muted")} strokeWidth={1.8} />
      <div className="min-w-0">
        <p className="m-0 flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
          {s.label}
          <Badge tone="neutral">{info.priorityLabel} priority</Badge>
          {info.confidentialityLabel !== "Normal" && <Badge tone="warning">{info.confidentialityLabel}</Badge>}
        </p>
        <p className="m-0 mt-0.5 text-[13px]">{s.text}</p>
        <p className="m-0 mt-0.5 text-[12px] text-text-muted tabular-nums">Open for {info.daysOpen} day{info.daysOpen === 1 ? "" : "s"}</p>
      </div>
    </div>
  );
}

export function IntakeDetails({ intake, now }: { intake: Intake; now: number }) {
  const i = intake;
  const deadline = i.responseDeadline;
  const deadlineDays = deadline ? Math.ceil((new Date(deadline.dueAt).getTime() - now) / DAY) : null;
  const deadlineText =
    deadline && deadlineDays !== null
      ? `${day(deadline.dueAt)}${deadline.status === "OPEN" ? (deadlineDays < 0 ? ` · overdue by ${-deadlineDays}d` : deadlineDays === 0 ? " · due today" : ` · in ${deadlineDays}d`) : " · done"}`
      : null;

  const hasOrigin = i.description || i.reportedAt || i.reportedBy || i.reportMethod;
  const hasParties = i.otherParty || i.otherParties.length > 0;
  const hasService = i.serviceDirection || i.processNature || i.issuedAt || i.receivedAt || deadline || i.receivedBy || i.recipientName;
  const hasCourt = i.forumName || i.courtStation || i.courtCaseNo || i.filedAt || i.jurisdiction || i.judge || i.eccmisNo;
  const hasRep = i.representationStatus || i.leadName || i.supportNames.length > 0 || i.externalCounselName || i.externalCounselContact;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Group icon={FileInput} title="Matter intake" empty={!hasOrigin}>
        {i.description && <p className="m-0 text-[13.5px] whitespace-pre-wrap">{i.description}</p>}
        <Row label="Reported">{i.reportedAt ? formatDate(new Date(i.reportedAt), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null}</Row>
        <Row label="Reported by">{i.reportedBy}</Row>
        <Row label="Method">{i.reportMethod}</Row>
      </Group>

      <Group icon={Users} title={`Parties · CAA is ${i.positionLabel}`} empty={!hasParties}>
        {i.otherParty && (
          <>
            <Row label="Other party">{i.otherParty.name}{i.otherParty.type ? <span className="font-normal text-text-muted"> · {i.otherParty.type}</span> : null}</Row>
            <Row label="Contact">{i.otherParty.contact}</Row>
            <Row label="Address">{i.otherParty.address}</Row>
          </>
        )}
        {i.otherParties.map((p, idx) => (
          <Row key={idx} label={p.role || "Party"}>
            {p.name}
            {p.organisation ? <span className="font-normal text-text-muted"> · {p.organisation}</span> : null}
          </Row>
        ))}
      </Group>

      <Group icon={Gavel} title="Service & legal process" empty={!hasService}>
        <Row label="Direction">{i.serviceDirection}</Row>
        <Row label="Process">{i.processNature}</Row>
        <Row label="Issued">{dateOnly(i.issuedAt)}</Row>
        <Row label="Received">{dateOnly(i.receivedAt)}</Row>
        <Row label="Response due">
          {deadlineText ? <span className={deadlineDays !== null && deadlineDays < 0 && deadline?.status === "OPEN" ? "text-danger" : undefined}>{deadlineText}</span> : null}
        </Row>
        <Row label="Received by">{i.receivedBy}</Row>
        <Row label="Legal recipient">{i.recipientName}</Row>
      </Group>

      <Group icon={Landmark} title="Court & forum" empty={!hasCourt}>
        <Row label="Court">{i.forumName}</Row>
        <Row label="Station">{i.courtStation}</Row>
        <Row label="Case number">{i.courtCaseNo}</Row>
        <Row label="Filed">{dateOnly(i.filedAt)}</Row>
        <Row label="Jurisdiction">{i.jurisdiction}</Row>
        <Row label="Judicial officer">{i.judge}</Row>
        <Row label="ECCMIS">{i.eccmisNo}</Row>
      </Group>

      <Group icon={Scale} title="Legal representation" empty={!hasRep}>
        <Row label="Status">{i.representationStatus}</Row>
        <Row label="Responsible">{i.leadName}</Row>
        <Row label="Supporting">{i.supportNames.length > 0 ? i.supportNames.join(", ") : null}</Row>
        <Row label="External counsel">{i.externalCounselName}</Row>
        <Row label="Counsel contact">{i.externalCounselContact}</Row>
      </Group>
    </div>
  );
}
