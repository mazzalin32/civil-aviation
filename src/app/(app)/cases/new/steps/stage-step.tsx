import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Stage } from "@/lib/validation/matter";
import { FieldGrid, StepHeader, type StepErrors } from "./shared";

export function StageStep({
  value,
  onChange,
  errors,
  stages,
  hasMatterType,
}: {
  value: Partial<Stage>;
  onChange: (patch: Partial<Stage>) => void;
  errors: StepErrors;
  stages: { id: string; name: string }[];
  hasMatterType: boolean;
}) {
  return (
    <>
      <StepHeader title="Matter stage" />
      <FieldGrid>
        <Field label="Current stage" htmlFor="g-stage" error={errors.stageTemplateId} hint={hasMatterType ? undefined : "Choose a matter type in step 1 first."}>
          <Select id="g-stage" value={value.stageTemplateId ?? ""} onChange={(e) => onChange({ stageTemplateId: e.target.value })} disabled={!hasMatterType}>
            <option value="">Select a stage</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="g-priority">
          <Select id="g-priority" value={value.priority ?? "MEDIUM"} onChange={(e) => onChange({ priority: e.target.value as Stage["priority"] })}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </Field>
        <Field label="Confidentiality" htmlFor="g-conf">
          <Select id="g-conf" value={value.confidentiality ?? "NORMAL"} onChange={(e) => onChange({ confidentiality: e.target.value as Stage["confidentiality"] })}>
            <option value="NORMAL">Normal</option>
            <option value="CONFIDENTIAL">Confidential</option>
            <option value="HIGHLY_CONFIDENTIAL">Highly confidential</option>
          </Select>
        </Field>
        <Field label="Next action due" htmlFor="g-next" hint="Added to the case calendar.">
          <Input id="g-next" type="date" value={value.nextActionDue ?? ""} onChange={(e) => onChange({ nextActionDue: e.target.value })} />
        </Field>
        <Field label="Internal notes" htmlFor="g-notes" className="sm:col-span-2 xl:col-span-3">
          <Textarea id="g-notes" value={value.internalNotes ?? ""} onChange={(e) => onChange({ internalNotes: e.target.value })} placeholder="The immediate next legal action…" />
        </Field>
      </FieldGrid>
    </>
  );
}
