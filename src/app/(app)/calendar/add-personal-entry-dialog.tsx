"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { addPersonalEntry } from "./actions";

export function AddPersonalEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await addPersonalEntry(formData);
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Personal entry">
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <p className="m-0 text-[13px] text-text-muted">Leave, training or anything else that affects your availability — visible to the Admin, not tied to a case.</p>
        <Field label="Title" htmlFor="pe-title">
          <Input id="pe-title" name="title" required autoFocus placeholder="e.g. Annual leave" />
        </Field>
        <Field label="Starts" htmlFor="pe-start">
          <Input id="pe-start" name="startsAt" type="datetime-local" icon={CalendarClock} required />
        </Field>
        <Field label="Ends" htmlFor="pe-end" hint="Optional">
          <Input id="pe-end" name="endsAt" type="datetime-local" />
        </Field>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}
