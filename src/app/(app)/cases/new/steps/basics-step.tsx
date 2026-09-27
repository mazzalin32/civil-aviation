import { FileText, Tag, GitBranch, Scale, Flag, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import type { Basics } from "@/lib/validation/matter";

export function BasicsStep({
  value,
  onChange,
  categories,
  matterTypes,
}: {
  value: Partial<Basics>;
  onChange: (patch: Partial<Basics>) => void;
  categories: { id: string; name: string }[];
  matterTypes: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-7">
      <FormSection step={1} title="What is this matter">
        <Field label="Case / matter title" htmlFor="b-title" className="sm:col-span-2">
          <Input
            id="b-title"
            icon={FileText}
            value={value.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. UCAA v. XYZ Aviation Ltd"
            autoFocus
          />
        </Field>
        <Field label="Category" htmlFor="b-category">
          <Select id="b-category" icon={Tag} value={value.categoryId ?? ""} onChange={(e) => onChange({ categoryId: e.target.value })}>
            <option value="">Choose a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Matter type" htmlFor="b-type" hint="Picks the lifecycle this case follows">
          <Select id="b-type" icon={GitBranch} value={value.matterTypeId ?? ""} onChange={(e) => onChange({ matterTypeId: e.target.value })}>
            <option value="">Choose a matter type…</option>
            {matterTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection step={2} title="Position and handling">
        <Field label="UCAA's role" htmlFor="b-role">
          <Select id="b-role" icon={Scale} value={value.ucaaRole ?? ""} onChange={(e) => onChange({ ucaaRole: e.target.value as Basics["ucaaRole"] })}>
            <option value="">Choose…</option>
            <option value="PLAINTIFF">Plaintiff</option>
            <option value="DEFENDANT">Defendant</option>
            <option value="APPLICANT">Applicant</option>
            <option value="RESPONDENT">Respondent</option>
            <option value="ADVISOR">Advisor</option>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="b-priority">
          <Select id="b-priority" icon={Flag} value={value.priority ?? "MEDIUM"} onChange={(e) => onChange({ priority: e.target.value as Basics["priority"] })}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </Field>
        <Field label="Confidentiality" htmlFor="b-conf" className="sm:col-span-2">
          <Select
            id="b-conf"
            icon={Lock}
            value={value.confidentiality ?? "NORMAL"}
            onChange={(e) => onChange({ confidentiality: e.target.value as Basics["confidentiality"] })}
          >
            <option value="NORMAL">Normal</option>
            <option value="CONFIDENTIAL">Confidential</option>
            <option value="HIGHLY_CONFIDENTIAL">Highly confidential</option>
          </Select>
        </Field>
      </FormSection>
    </div>
  );
}
