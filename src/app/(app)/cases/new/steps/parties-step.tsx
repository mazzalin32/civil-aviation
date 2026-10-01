import { Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PARTY_TYPES, type Parties, type PartyRow } from "@/lib/validation/matter";
import { FieldGrid, Options, StepHeader } from "./shared";

export function PartiesStep({ value, onChange }: { value: Partial<Parties>; onChange: (patch: Partial<Parties>) => void }) {
  const rows: PartyRow[] = value.rows && value.rows.length > 0 ? value.rows : [{}];
  const update = (i: number, patch: Partial<PartyRow>) => onChange({ rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });

  return (
    <>
      <StepHeader
        step={4}
        eyebrow="Parties"
        title="Parties to the matter"
        description="Add every other relevant party, such as witnesses and interested parties, and describe their role. The main other party was captured in step 2."
      />
      <div className="grid gap-4">
        {rows.map((row, i) => (
          <section key={i} className="rounded-[12px] border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <User className="size-4 text-text-muted" />
              <h3 className="m-0 text-[13.5px] font-semibold">Party {i + 1}</h3>
              {rows.length > 1 && (
                <button type="button" aria-label={`Remove party ${i + 1}`} onClick={() => onChange({ rows: rows.filter((_, idx) => idx !== i) })} className="ml-auto text-text-muted hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            <FieldGrid>
              <Field label="Party name" htmlFor={`pt-name-${i}`}>
                <Input id={`pt-name-${i}`} value={row.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} placeholder="Full legal name" />
              </Field>
              <Field label="Organisation" htmlFor={`pt-org-${i}`}>
                <Input id={`pt-org-${i}`} value={row.organisation ?? ""} onChange={(e) => update(i, { organisation: e.target.value })} placeholder="Company or institution" />
              </Field>
              <Field label="Party type" htmlFor={`pt-type-${i}`}>
                <Select id={`pt-type-${i}`} value={row.partyType ?? ""} onChange={(e) => update(i, { partyType: e.target.value })}>
                  <Options values={PARTY_TYPES} />
                </Select>
              </Field>
              <Field label="Role in matter" htmlFor={`pt-role-${i}`}>
                <Input id={`pt-role-${i}`} value={row.role ?? ""} onChange={(e) => update(i, { role: e.target.value })} placeholder="e.g. Witness, interested party" />
              </Field>
            </FieldGrid>
          </section>
        ))}
      </div>
      <Button type="button" variant="ghost" className="mt-3 text-primary" onClick={() => onChange({ rows: [...rows, {}] })}>
        <Plus className="size-4" /> Add party
      </Button>
    </>
  );
}
