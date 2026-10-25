import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_METHODS, REPORTED_BY, type Identification } from "@/lib/validation/matter";
import { FieldGrid, Options, StepHeader, type StepErrors } from "./shared";

export function IdentificationStep({
  value,
  onChange,
  errors,
  categories,
  matterTypes,
}: {
  value: Partial<Identification>;
  onChange: (patch: Partial<Identification>) => void;
  errors: StepErrors;
  categories: { id: string; name: string }[];
  matterTypes: { id: string; name: string; referencePrefix: string | null }[];
}) {
  const prefix = matterTypes.find((t) => t.id === value.matterTypeId)?.referencePrefix;
  const reference = prefix ? `UCAA/${prefix}/${new Date().getFullYear()}/####` : "Choose a matter type to see the reference";

  return (
    <>
      <StepHeader title="Matter identification" />
      <FieldGrid>
        <Field label="Case reference" htmlFor="i-ref" hint="Generated on submit.">
          <Input id="i-ref" value={reference} readOnly disabled className="font-mono tabular-nums" />
        </Field>
        <Field label="Matter title" htmlFor="i-title" error={errors.title}>
          <Input id="i-title" value={value.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="e.g. Nile Horizon Aviation Ltd v Uganda Civil Aviation Authority" autoFocus />
        </Field>
        <Field label="Category" htmlFor="i-category" error={errors.categoryId} hint="What the matter is about.">
          <Select id="i-category" value={value.categoryId ?? ""} onChange={(e) => onChange({ categoryId: e.target.value })}>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Matter type" htmlFor="i-type" error={errors.matterTypeId} hint="Picks the case's lifecycle.">
          <Select id="i-type" value={value.matterTypeId ?? ""} onChange={(e) => onChange({ matterTypeId: e.target.value })}>
            <option value="">Select a matter type</option>
            {matterTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date matter reported" htmlFor="i-date" error={errors.reportedDate}>
          <Input id="i-date" type="date" value={value.reportedDate ?? ""} onChange={(e) => onChange({ reportedDate: e.target.value })} />
        </Field>
        <Field label="Time reported" htmlFor="i-time" error={errors.reportedTime}>
          <Input id="i-time" type="time" value={value.reportedTime ?? ""} onChange={(e) => onChange({ reportedTime: e.target.value })} />
        </Field>
        <Field label="Reported by" htmlFor="i-by">
          <Select id="i-by" value={value.reportedBy ?? ""} onChange={(e) => onChange({ reportedBy: e.target.value })}>
            <Options values={REPORTED_BY} />
          </Select>
        </Field>
        <Field label="Method of report" htmlFor="i-method">
          <Select id="i-method" value={value.reportMethod ?? ""} onChange={(e) => onChange({ reportMethod: e.target.value })}>
            <Options values={REPORT_METHODS} />
          </Select>
        </Field>
        <Field label="Brief description" htmlFor="i-desc" error={errors.description} className="sm:col-span-2 xl:col-span-3">
          <Textarea id="i-desc" value={value.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} placeholder="How the matter originated…" />
        </Field>
      </FieldGrid>
    </>
  );
}
