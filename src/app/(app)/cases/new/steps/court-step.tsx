import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { JURISDICTIONS, type Court } from "@/lib/validation/matter";
import { FieldGrid, Options, StepHeader } from "./shared";

export function CourtStep({
  value,
  onChange,
  forums,
}: {
  value: Partial<Court>;
  onChange: (patch: Partial<Court>) => void;
  forums: { id: string; name: string; division: string | null }[];
}) {
  const skip = value.skip ?? false;
  return (
    <>
      <StepHeader title="Court & judicial information" />
      <label className="mb-4 flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={skip} onChange={(e) => onChange({ skip: e.target.checked })} className="size-4 accent-[var(--primary)]" />
        This matter is not before a court or tribunal yet
      </label>
      <div className={skip ? "pointer-events-none opacity-50" : undefined} aria-disabled={skip}>
        <FieldGrid>
          <Field label="Court / tribunal" htmlFor="c-forum">
            <Select id="c-forum" value={value.forumId ?? ""} onChange={(e) => onChange({ forumId: e.target.value })} disabled={skip}>
              <option value="">Select a court or tribunal</option>
              {forums.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.division ? ` — ${f.division}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Court station" htmlFor="c-station">
            <Input id="c-station" value={value.courtStation ?? ""} onChange={(e) => onChange({ courtStation: e.target.value })} placeholder="e.g. Kampala" disabled={skip} />
          </Field>
          <Field label="Case number" htmlFor="c-no">
            <Input id="c-no" value={value.courtCaseNo ?? ""} onChange={(e) => onChange({ courtCaseNo: e.target.value })} placeholder="Court-assigned number, if available" disabled={skip} />
          </Field>
          <Field label="Date filed" htmlFor="c-filed">
            <Input id="c-filed" type="date" value={value.filedAt ?? ""} onChange={(e) => onChange({ filedAt: e.target.value })} disabled={skip} />
          </Field>
          <Field label="Jurisdiction" htmlFor="c-jur">
            <Select id="c-jur" value={value.jurisdiction ?? ""} onChange={(e) => onChange({ jurisdiction: e.target.value })} disabled={skip}>
              <Options values={JURISDICTIONS} />
            </Select>
          </Field>
          <Field label="Presiding judicial officer" htmlFor="c-judge">
            <Input id="c-judge" value={value.judge ?? ""} onChange={(e) => onChange({ judge: e.target.value })} placeholder="Name, if known" disabled={skip} />
          </Field>
          <Field label="ECCMIS number" htmlFor="c-eccmis" hint="Judiciary e-filing reference — stored, not integrated.">
            <Input id="c-eccmis" value={value.eccmisNo ?? ""} onChange={(e) => onChange({ eccmisNo: e.target.value })} placeholder="If filed electronically" disabled={skip} />
          </Field>
          <Field label="ECCMIS link" htmlFor="c-eccmis-url">
            <Input id="c-eccmis-url" value={value.eccmisUrl ?? ""} onChange={(e) => onChange({ eccmisUrl: e.target.value })} placeholder="https://" disabled={skip} />
          </Field>
        </FieldGrid>
      </div>
    </>
  );
}
