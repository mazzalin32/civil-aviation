import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { REPRESENTATION_STATUSES, type Representation } from "@/lib/validation/matter";
import { FieldGrid, Options, StepHeader, type StepErrors } from "./shared";

export type LawyerOption = { id: string; name: string; title: string | null; workload: number };

export function RepresentationStep({
  value,
  onChange,
  errors,
  lawyers,
}: {
  value: Partial<Representation>;
  onChange: (patch: Partial<Representation>) => void;
  errors: StepErrors;
  lawyers: LawyerOption[];
}) {
  const support = value.supportUserIds ?? [];
  const toggleSupport = (id: string) => onChange({ supportUserIds: support.includes(id) ? support.filter((s) => s !== id) : [...support, id] });

  return (
    <>
      <StepHeader title="Legal representation" />
      <FieldGrid>
        <Field label="Representation status" htmlFor="r-status">
          <Select id="r-status" value={value.representationStatus ?? ""} onChange={(e) => onChange({ representationStatus: e.target.value })}>
            <Options values={REPRESENTATION_STATUSES} />
          </Select>
        </Field>
        <Field label="Responsible legal officer" htmlFor="r-lead" error={errors.leadUserId} hint="Becomes the lead lawyer.">
          <Select id="r-lead" value={value.leadUserId ?? ""} onChange={(e) => onChange({ leadUserId: e.target.value, supportUserIds: support.filter((s) => s !== e.target.value) })}>
            <option value="">Select a lawyer</option>
            {lawyers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.title ? ` — ${l.title}` : ""} · {l.workload} open
              </option>
            ))}
          </Select>
        </Field>
        <Field label="External counsel / law firm" htmlFor="r-firm">
          <Input id="r-firm" value={value.externalCounselName ?? ""} onChange={(e) => onChange({ externalCounselName: e.target.value })} placeholder="Firm or advocate name" />
        </Field>
        <Field label="Counsel contact" htmlFor="r-contact">
          <Input id="r-contact" value={value.externalCounselContact ?? ""} onChange={(e) => onChange({ externalCounselContact: e.target.value })} placeholder="Email or telephone" />
        </Field>
      </FieldGrid>

      <p className="m-0 mt-2 mb-2 text-[13px] font-medium">Supporting lawyers (optional)</p>
      <div className="flex flex-wrap gap-2">
        {lawyers
          .filter((l) => l.id !== value.leadUserId)
          .map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={support.includes(l.id)}
              onClick={() => toggleSupport(l.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                support.includes(l.id) ? "border-primary bg-primary-soft font-medium" : "border-border bg-surface text-text-muted hover:border-primary hover:text-text",
              )}
            >
              {l.name}
            </button>
          ))}
      </div>
    </>
  );
}
