import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PARTY_TYPES, UCAA_POSITIONS, type Position } from "@/lib/validation/matter";
import { FieldGrid, Options, StepHeader, type StepErrors } from "./shared";

export function PositionStep({ value, onChange, errors }: { value: Partial<Position>; onChange: (patch: Partial<Position>) => void; errors: StepErrors }) {
  const chosen = UCAA_POSITIONS.find((p) => p.value === value.ucaaRole);
  return (
    <>
      <StepHeader title="CAA position & parties" />
      <p className="m-0 mb-2 text-[13px] font-medium">CAA&apos;s position</p>
      <div role="radiogroup" aria-label="CAA's position" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {UCAA_POSITIONS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={value.ucaaRole === p.value}
            onClick={() => onChange({ ucaaRole: p.value })}
            className={cn(
              "h-10 rounded-control border px-2 text-[13px] transition-colors",
              value.ucaaRole === p.value ? "border-primary bg-primary-soft font-medium text-text" : "border-border bg-surface text-text-muted hover:border-primary hover:text-text",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="m-0 mt-1 min-h-[16px] text-xs text-danger" role="alert">
        {errors.ucaaRole}
      </p>

      {chosen && (
        <p className="m-0 mt-3 mb-5 rounded-[12px] border border-primary/20 bg-primary-soft px-4 py-3 text-[13px] font-medium">
          CAA is the {chosen.label}.
        </p>
      )}

      <FieldGrid>
        <Field label={chosen?.against ?? "Who is the other party?"} htmlFor="p-name">
          <Input id="p-name" value={value.partyName ?? ""} onChange={(e) => onChange({ partyName: e.target.value })} placeholder="Party or organisation name" />
        </Field>
        <Field label="Party type" htmlFor="p-type">
          <Select id="p-type" value={value.partyType ?? ""} onChange={(e) => onChange({ partyType: e.target.value })}>
            <Options values={PARTY_TYPES} />
          </Select>
        </Field>
        <Field label="Contact information" htmlFor="p-contact">
          <Input id="p-contact" value={value.partyContact ?? ""} onChange={(e) => onChange({ partyContact: e.target.value })} placeholder="Email or telephone" />
        </Field>
        <Field label="Address" htmlFor="p-address">
          <Input id="p-address" value={value.partyAddress ?? ""} onChange={(e) => onChange({ partyAddress: e.target.value })} placeholder="Physical or postal address" />
        </Field>
      </FieldGrid>
    </>
  );
}
