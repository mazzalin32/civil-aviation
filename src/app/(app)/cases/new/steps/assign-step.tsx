import { UserCheck, GitCommitHorizontal, AlertTriangle } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import type { AssignStep as AssignStepData } from "@/lib/validation/matter";

export type LawyerOption = { id: string; name: string; title: string | null; workload: number };

export function AssignStep({
  value,
  onChange,
  lawyers,
  stages,
}: {
  value: Partial<AssignStepData>;
  onChange: (patch: Partial<AssignStepData>) => void;
  lawyers: LawyerOption[];
  stages: { id: string; name: string }[];
}) {
  const supportIds = value.supportUserIds ?? [];

  function toggleSupport(id: string) {
    onChange({ supportUserIds: supportIds.includes(id) ? supportIds.filter((s) => s !== id) : [...supportIds, id] });
  }

  return (
    <div className="grid gap-7">
      <FormSection step={1} title="Legal team">
        <Field label="Lead lawyer" htmlFor="as-lead" hint="Workload = their other open/on-hold cases">
          <Select id="as-lead" icon={UserCheck} value={value.leadUserId ?? ""} onChange={(e) => onChange({ leadUserId: e.target.value })}>
            <option value="">Choose…</option>
            {lawyers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.workload} open case{l.workload === 1 ? "" : "s"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Starting stage" htmlFor="as-stage">
          <Select id="as-stage" icon={GitCommitHorizontal} value={value.stageTemplateId ?? ""} onChange={(e) => onChange({ stageTemplateId: e.target.value })} disabled={stages.length === 0}>
            <option value="">{stages.length === 0 ? "Choose a matter type first…" : "Choose…"}</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-medium">Supporting lawyers</span>
          <div className="grid gap-2 rounded-card border border-border p-3 sm:grid-cols-2">
            {lawyers.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={supportIds.includes(l.id)}
                  disabled={l.id === value.leadUserId}
                  onChange={() => toggleSupport(l.id)}
                  className="size-4 accent-primary"
                />
                {l.name}
                {l.id === value.leadUserId && <span className="text-text-muted">(lead)</span>}
              </label>
            ))}
          </div>
        </div>
      </FormSection>

      <p className="m-0 flex items-start gap-1.5 text-xs text-text-muted">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        First deadline/hearing and initial documents aren&apos;t collected here yet — the calendar and secure documents arrive in later
        phases. Add them from the case page once it&apos;s built.
      </p>
    </div>
  );
}
