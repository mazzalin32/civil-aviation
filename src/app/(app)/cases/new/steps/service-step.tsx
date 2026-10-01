import { Gavel } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PROCESS_NATURES, UCAA_POSITIONS, type Position, type Service } from "@/lib/validation/matter";
import { formatDate } from "@/lib/time";
import { FieldGrid, Options, StepHeader } from "./shared";

const DIRECTIONS = [
  { value: "CAA_SERVING", title: "CAA is serving", hint: "CAA initiated service" },
  { value: "CAA_SERVED", title: "CAA has been served", hint: "CAA received legal process" },
  { value: "NOT_YET_SERVED", title: "Not yet served", hint: "Service details pending" },
] as const;

export function ServiceStep({
  value,
  onChange,
  position,
  lawyers,
}: {
  value: Partial<Service>;
  onChange: (patch: Partial<Service>) => void;
  position: Partial<Position>;
  lawyers: { id: string; name: string }[];
}) {
  const direction = value.direction ?? "NOT_YET_SERVED";
  const serving = direction === "CAA_SERVING";
  const positionLabel = UCAA_POSITIONS.find((p) => p.value === position.ucaaRole)?.label;
  const received = value.receivedAt ? formatDate(new Date(`${value.receivedAt}T00:00:00Z`), { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <>
      <StepHeader step={3} eyebrow="Service / legal process" title="Service & legal process" description="Record how the legal process relates to CAA and capture the relevant deadlines." />
      <p className="m-0 mb-2 text-[13px] font-medium">Service direction</p>
      <div role="radiogroup" aria-label="Service direction" className="mb-5 grid gap-3 sm:grid-cols-3">
        {DIRECTIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            role="radio"
            aria-checked={direction === d.value}
            onClick={() => onChange({ direction: d.value })}
            className={cn(
              "grid gap-0.5 rounded-[12px] border p-4 text-left transition-colors",
              direction === d.value ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary",
            )}
          >
            <Gavel className={cn("mb-2 size-4", direction === d.value ? "text-primary" : "text-text-muted")} />
            <span className="text-[13.5px] font-medium">{d.title}</span>
            <span className="text-xs text-text-muted">{d.hint}</span>
          </button>
        ))}
      </div>

      <FieldGrid>
        <Field label="Nature of legal process" htmlFor="s-nature">
          <Select id="s-nature" value={value.processNature ?? ""} onChange={(e) => onChange({ processNature: e.target.value })}>
            <Options values={PROCESS_NATURES} />
          </Select>
        </Field>
        <Field label="Date process was issued" htmlFor="s-issued">
          <Input id="s-issued" type="date" value={value.issuedAt ?? ""} onChange={(e) => onChange({ issuedAt: e.target.value })} />
        </Field>
        <Field label={serving ? "Date served by CAA" : "Date received by CAA"} htmlFor="s-received">
          <Input id="s-received" type="date" value={value.receivedAt ?? ""} onChange={(e) => onChange({ receivedAt: e.target.value })} />
        </Field>
        <Field label="Response deadline" htmlFor="s-deadline" hint="Becomes a critical deadline on the case calendar.">
          <Input id="s-deadline" type="date" value={value.responseDeadline ?? ""} onChange={(e) => onChange({ responseDeadline: e.target.value })} />
        </Field>
        <Field label={serving ? "Served by" : "Received by"} htmlFor="s-by">
          <Input id="s-by" value={value.receivedBy ?? ""} onChange={(e) => onChange({ receivedBy: e.target.value })} placeholder="Name of officer" />
        </Field>
        <Field label="Legal department recipient" htmlFor="s-recipient">
          <Select id="s-recipient" value={value.recipientId ?? ""} onChange={(e) => onChange({ recipientId: e.target.value })}>
            <option value="">Select an option</option>
            {lawyers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <dl className="m-0 mt-3 grid gap-3 rounded-[12px] border border-border bg-surface-muted p-4 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-xs text-text-muted">CAA position</dt>
          <dd className="m-0 font-medium">{positionLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Process</dt>
          <dd className="m-0 font-medium">{value.processNature || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">{serving ? "Served" : "Received"}</dt>
          <dd className="m-0 font-medium">{received ?? "—"}</dd>
        </div>
      </dl>
    </>
  );
}
