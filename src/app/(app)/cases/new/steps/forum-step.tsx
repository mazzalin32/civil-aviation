import { Landmark, Hash, Link2, Gavel } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { cn } from "@/lib/utils";
import type { ForumStep as ForumStepData } from "@/lib/validation/matter";

export function ForumStep({
  value,
  onChange,
  forums,
}: {
  value: Partial<ForumStepData>;
  onChange: (patch: Partial<ForumStepData>) => void;
  forums: { id: string; name: string; division: string | null }[];
}) {
  return (
    <div className="grid gap-7">
      <div className="flex items-center justify-between rounded-card border border-border bg-surface-muted/50 px-4 py-3">
        <div>
          <p className="m-0 text-[13px] font-medium">Advisory matter with no court or tribunal involved?</p>
          <p className="m-0 text-xs text-text-muted">Skip this step — nothing here is required to continue.</p>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={value.skip ?? false} onChange={(e) => onChange({ skip: e.target.checked })} className="size-4 accent-primary" />
          Skip
        </label>
      </div>

      <fieldset disabled={value.skip} className={cn("grid gap-7", value.skip && "pointer-events-none opacity-40")}>
        <FormSection step={1} title="Court / tribunal">
          <Field label="Court or tribunal" htmlFor="f-forum" className="sm:col-span-2">
            <Select id="f-forum" icon={Landmark} value={value.forumId ?? ""} onChange={(e) => onChange({ forumId: e.target.value })}>
              <option value="">Choose…</option>
              {forums.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.division ? ` — ${f.division}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Court case number" htmlFor="f-caseno">
            <Input id="f-caseno" icon={Hash} value={value.courtCaseNo ?? ""} onChange={(e) => onChange({ courtCaseNo: e.target.value })} />
          </Field>
          <Field label="Judge / registrar" htmlFor="f-judge">
            <Input id="f-judge" icon={Gavel} value={value.judge ?? ""} onChange={(e) => onChange({ judge: e.target.value })} />
          </Field>
        </FormSection>

        <FormSection step={2} title="e-Filing (ECCMIS)">
          <Field label="ECCMIS number" htmlFor="f-eccmis">
            <Input id="f-eccmis" icon={Hash} value={value.eccmisNo ?? ""} onChange={(e) => onChange({ eccmisNo: e.target.value })} placeholder="e.g. HCT-00-CC-CS-0412-2026" />
          </Field>
          <Field label="ECCMIS link" htmlFor="f-eccmis-url" hint="Stored for reference — not integrated (CLAUDE.md)">
            <Input id="f-eccmis-url" icon={Link2} value={value.eccmisUrl ?? ""} onChange={(e) => onChange({ eccmisUrl: e.target.value })} />
          </Field>
        </FormSection>
      </fieldset>
    </div>
  );
}
