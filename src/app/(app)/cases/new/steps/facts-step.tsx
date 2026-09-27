import { Coins, CalendarClock, FileSignature } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import type { FactsStep as FactsStepData } from "@/lib/validation/matter";

export function FactsStep({
  value,
  onChange,
}: {
  value: Partial<FactsStepData>;
  onChange: (patch: Partial<FactsStepData>) => void;
}) {
  return (
    <div className="grid gap-7">
      <FormSection step={1} title="What it's about">
        <Field label="Short description" htmlFor="fa-desc" className="sm:col-span-2">
          <textarea
            id="fa-desc"
            value={value.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={4}
            className="w-full rounded-none border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          />
        </Field>
        <Field label="How it came to Legal" htmlFor="fa-referral" hint="Referral memo" className="sm:col-span-2">
          <textarea
            id="fa-referral"
            value={value.referralNote ?? ""}
            onChange={(e) => onChange({ referralNote: e.target.value })}
            rows={3}
            className="w-full rounded-none border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          />
        </Field>
      </FormSection>

      <FormSection step={2} title="Value & timing">
        <Field label="Amount claimed (UGX)" htmlFor="fa-claimed" error={value.amountClaimed && !/^\d*$/.test(value.amountClaimed) ? "Whole number only" : undefined}>
          <Input id="fa-claimed" icon={Coins} inputMode="numeric" value={value.amountClaimed ?? ""} onChange={(e) => onChange({ amountClaimed: e.target.value.replace(/[^\d]/g, "") })} />
        </Field>
        <Field label="Amount against / exposure (UGX)" htmlFor="fa-against">
          <Input id="fa-against" icon={Coins} inputMode="numeric" value={value.amountAgainst ?? ""} onChange={(e) => onChange({ amountAgainst: e.target.value.replace(/[^\d]/g, "") })} />
        </Field>
        <Field label="Date cause of action arose" htmlFor="fa-cause">
          <Input id="fa-cause" type="date" icon={CalendarClock} value={value.causeOfActionDate ?? ""} onChange={(e) => onChange({ causeOfActionDate: e.target.value })} />
        </Field>
      </FormSection>
      <p className="m-0 flex items-center gap-1.5 text-xs text-text-muted">
        <FileSignature className="size-3.5" /> Amounts and dates can be refined later from the case page.
      </p>
    </div>
  );
}
