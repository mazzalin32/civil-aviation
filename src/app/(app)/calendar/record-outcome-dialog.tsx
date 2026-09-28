"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { recordOutcome } from "./actions";

export type OutcomeEntry = { id: string; title: string; kind: string; startsAt: string };

export function RecordOutcomeDialog({ entry, onClose }: { entry: OutcomeEntry | null; onClose: () => void }) {
  const [outcomeType, setOutcomeType] = useState<"PROCEEDED" | "ADJOURNED" | "RULING" | "DIRECTIONS">("PROCEEDED");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    if (!entry) return;
    setError(undefined);
    startTransition(async () => {
      // Only the fields for the selected outcome type are actually rendered, so an
      // unrendered field's formData.get() is null, not "" — which fails the (string)
      // zod schema outright. Coerce every optional field to "" before sending.
      const result = await recordOutcome({
        entryId: entry.id,
        outcomeType,
        outcomeNote: formData.get("outcomeNote") ?? "",
        adjournmentReason: formData.get("adjournmentReason") ?? "",
        nextDate: formData.get("nextDate") ?? "",
        directions: formData.get("directions") ?? "",
      });
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={entry !== null} onClose={onClose} title="Record outcome">
      {entry && (
        <form action={submit} className="grid gap-4">
          <p className="m-0 text-[13px] font-medium">{entry.title}</p>
          {error && <p className="m-0 text-xs text-danger">{error}</p>}

          <Field label="What happened" htmlFor="ro-type">
            <Select id="ro-type" value={outcomeType} onChange={(e) => setOutcomeType(e.target.value as typeof outcomeType)}>
              <option value="PROCEEDED">Proceeded</option>
              <option value="ADJOURNED">Adjourned</option>
              <option value="RULING">Ruling / judgment delivered</option>
              <option value="DIRECTIONS">Directions given</option>
            </Select>
          </Field>

          {outcomeType === "PROCEEDED" && (
            <>
              <Field label="Notes" htmlFor="ro-note">
                <textarea id="ro-note" name="outcomeNote" rows={3} className="w-full rounded-control border border-border bg-surface p-3 text-sm" />
              </Field>
              <Field label="Next date" htmlFor="ro-next" hint="Optional">
                <Input id="ro-next" name="nextDate" type="datetime-local" />
              </Field>
            </>
          )}

          {outcomeType === "ADJOURNED" && (
            <>
              <Field label="Reason" htmlFor="ro-reason">
                <Input id="ro-reason" name="adjournmentReason" required placeholder="e.g. Judge absent" />
              </Field>
              <Field label="Next date" htmlFor="ro-next2">
                <Input id="ro-next2" name="nextDate" type="datetime-local" required />
              </Field>
            </>
          )}

          {outcomeType === "RULING" && (
            <Field label="Outcome summary" htmlFor="ro-ruling-note" hint="Logged to the timeline; a matching deadline is suggested automatically if one is configured">
              <textarea id="ro-ruling-note" name="outcomeNote" rows={4} className="w-full rounded-control border border-border bg-surface p-3 text-sm" />
            </Field>
          )}

          {outcomeType === "DIRECTIONS" && (
            <>
              <Field label="Directions" htmlFor="ro-directions" hint="One per line — each becomes a task">
                <textarea id="ro-directions" name="directions" rows={4} className="w-full rounded-control border border-border bg-surface p-3 text-sm" />
              </Field>
              <Field label="Due date" htmlFor="ro-due" hint="Defaults to 7 days out if left blank">
                <Input id="ro-due" name="nextDate" type="date" />
              </Field>
            </>
          )}

          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save outcome"}
            </Button>
            <Button type="button" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </SlideOver>
  );
}
