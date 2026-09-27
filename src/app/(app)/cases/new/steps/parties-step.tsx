import { Plus, Trash2, User, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import type { PartiesStep as PartiesStepData, PartyRow } from "@/lib/validation/matter";

const emptyParty: PartyRow = { name: "", counselName: "", counselFirm: "", email: "", phone: "" };

export function PartiesStep({
  value,
  onChange,
}: {
  value: Partial<PartiesStepData>;
  onChange: (patch: Partial<PartiesStepData>) => void;
}) {
  const opposing = value.opposing ?? [];
  const witnesses = value.witnesses ?? [];

  return (
    <div className="grid gap-7">
      <FormSection step={1} title="Opposing parties & counsel">
        <div className="grid gap-4 sm:col-span-2">
          {opposing.map((p, i) => (
            <div key={i} className="grid gap-3 rounded-card border border-border p-4 sm:grid-cols-2">
              <Field label="Party name" htmlFor={`op-name-${i}`}>
                <Input
                  id={`op-name-${i}`}
                  icon={User}
                  value={p.name}
                  onChange={(e) => onChange({ opposing: opposing.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)) })}
                />
              </Field>
              <Field label="Counsel name" htmlFor={`op-counsel-${i}`}>
                <Input
                  id={`op-counsel-${i}`}
                  value={p.counselName ?? ""}
                  onChange={(e) => onChange({ opposing: opposing.map((r, j) => (j === i ? { ...r, counselName: e.target.value } : r)) })}
                />
              </Field>
              <Field label="Counsel firm" htmlFor={`op-firm-${i}`}>
                <Input
                  id={`op-firm-${i}`}
                  icon={Building2}
                  value={p.counselFirm ?? ""}
                  onChange={(e) => onChange({ opposing: opposing.map((r, j) => (j === i ? { ...r, counselFirm: e.target.value } : r)) })}
                />
              </Field>
              <div className="flex items-end gap-2">
                <Field label="Phone" htmlFor={`op-phone-${i}`} className="flex-1">
                  <Input
                    id={`op-phone-${i}`}
                    value={p.phone ?? ""}
                    onChange={(e) => onChange({ opposing: opposing.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r)) })}
                  />
                </Field>
                <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ opposing: opposing.filter((_, j) => j !== i) })} aria-label="Remove party">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" onClick={() => onChange({ opposing: [...opposing, { ...emptyParty }] })} className="justify-self-start">
            <Plus className="size-4" /> Add opposing party
          </Button>
        </div>
      </FormSection>

      <FormSection step={2} title="Witnesses">
        <div className="grid gap-3 sm:col-span-2">
          {witnesses.map((w, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label="Name" htmlFor={`wit-name-${i}`} className="flex-1">
                <Input
                  id={`wit-name-${i}`}
                  icon={User}
                  value={w.name}
                  onChange={(e) => onChange({ witnesses: witnesses.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)) })}
                />
              </Field>
              <Field label="Phone" htmlFor={`wit-phone-${i}`} className="flex-1">
                <Input
                  id={`wit-phone-${i}`}
                  value={w.phone ?? ""}
                  onChange={(e) => onChange({ witnesses: witnesses.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r)) })}
                />
              </Field>
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ witnesses: witnesses.filter((_, j) => j !== i) })} aria-label="Remove witness">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" onClick={() => onChange({ witnesses: [...witnesses, { name: "", phone: "" }] })} className="justify-self-start">
            <Plus className="size-4" /> Add witness
          </Button>
        </div>
      </FormSection>

      <FormSection step={3} title="Internal UCAA contact">
        <Field label="Contact name" htmlFor="p-internal-name">
          <Input id="p-internal-name" icon={User} value={value.internalContactName ?? ""} onChange={(e) => onChange({ internalContactName: e.target.value })} />
        </Field>
        <Field label="Department" htmlFor="p-internal-dept" hint="The department that raised the matter">
          <Input id="p-internal-dept" icon={Building2} value={value.internalContactDepartment ?? ""} onChange={(e) => onChange({ internalContactDepartment: e.target.value })} />
        </Field>
      </FormSection>
    </div>
  );
}
