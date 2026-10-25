import { CalendarClock, Info } from "lucide-react";
import { UCAA_POSITIONS, type WizardData } from "@/lib/validation/matter";
import { formatDate } from "@/lib/time";
import { StepHeader } from "./shared";

const SERVICE_LABEL = { CAA_SERVING: "CAA is serving", CAA_SERVED: "CAA has been served", NOT_YET_SERVED: "Not yet served" } as const;
const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" } as const;
const dateLabel = (v?: string) => (v ? formatDate(new Date(`${v}T00:00:00Z`), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null);

function Item({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-border px-4 py-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className={`m-0 mt-0.5 truncate text-[13.5px] font-medium ${mono ? "font-mono tabular-nums" : ""} ${value ? "" : "text-text-muted"}`} title={value ?? undefined}>
        {value || "Not provided"}
      </dd>
    </div>
  );
}

export function ReviewStep({
  data,
  categoryName,
  matterTypeName,
  referencePrefix,
  stageName,
  forumName,
  leadName,
  supportNames,
  fileCount,
}: {
  data: WizardData;
  categoryName?: string;
  matterTypeName?: string;
  referencePrefix?: string | null;
  stageName?: string;
  forumName?: string;
  leadName?: string;
  supportNames: string[];
  fileCount: number;
}) {
  const id = data.identification ?? {};
  const position = UCAA_POSITIONS.find((p) => p.value === data.position?.ucaaRole)?.label;
  const service = data.service ?? {};
  const stage = data.stage ?? {};
  const otherParties = (data.parties?.rows ?? []).filter((r) => r.name).length + (data.position?.partyName ? 1 : 0);
  const deadlines = [service.responseDeadline && `Response deadline ${dateLabel(service.responseDeadline)}`, stage.nextActionDue && `Next action ${dateLabel(stage.nextActionDue)}`].filter(Boolean) as string[];

  return (
    <>
      <StepHeader title="Review and submit" />
      <dl className="m-0 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Item label="Case reference" value={referencePrefix ? `UCAA/${referencePrefix}/${new Date().getFullYear()}/#### (generated)` : null} mono />
        <Item label="Matter title" value={id.title} />
        <Item label="Category" value={categoryName} />
        <Item label="Matter type" value={matterTypeName} />
        <Item label="CAA position" value={position} />
        <Item label="Service direction" value={service.direction ? SERVICE_LABEL[service.direction] : SERVICE_LABEL.NOT_YET_SERVED} />
        <Item label="Court / tribunal" value={data.court?.skip ? "Not before a court yet" : forumName} />
        <Item label="Parties recorded" value={otherParties > 0 ? String(otherParties) : null} />
        <Item label="Responsible legal officer" value={leadName} />
        <Item label="Supporting lawyers" value={supportNames.length ? supportNames.join(", ") : null} />
        <Item label="Current stage" value={stageName} />
        <Item label="Priority" value={PRIORITY_LABEL[stage.priority ?? "MEDIUM"]} />
        <Item label="Documents attached" value={fileCount > 0 ? String(fileCount) : null} />
      </dl>

      {deadlines.length > 0 && (
        <p className="m-0 mt-4 flex items-start gap-2 rounded-[12px] border border-border bg-surface-muted px-4 py-3 text-[13px]">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-text-muted" />
          <span>
            Calendar deadlines that will be created: <strong>{deadlines.join(" · ")}</strong>
          </span>
        </p>
      )}
      <p className="m-0 mt-3 flex items-start gap-2 rounded-[12px] border border-warning/40 bg-warning-soft px-4 py-3 text-[13px]">
        <Info className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>
          By submitting, this matter will be created as <strong>Open</strong>, a reference will be generated, and the responsible legal officer will be notified.
        </span>
      </p>
    </>
  );
}
