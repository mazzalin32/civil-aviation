"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SlideOver } from "@/components/ui/slide-over";
import { addPersonalEntry } from "./actions";
import { withToast } from "@/components/ui/toast";

export function AddPersonalEntryDialog({
  open,
  onClose,
  matters,
  staff,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  matters: { id: string; reference: string; title: string }[];
  staff: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(addPersonalEntry(formData), "Entry added");
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Personal entry">
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <p className="m-0 text-[13px] text-text-muted">Leave, training or anything else that affects availability.</p>
        <Field label="Title" htmlFor="pe-title">
          <Input id="pe-title" name="title" required autoFocus placeholder="e.g. Annual leave" />
        </Field>
        {staff.length > 0 && (
          <Field label="For" htmlFor="pe-for" hint="Appears on their calendar, not just yours.">
            <Select id="pe-for" name="forUserId" defaultValue={currentUserId}>
              <option value={currentUserId}>Myself</option>
              {staff.filter((s) => s.id !== currentUserId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Related case" htmlFor="pe-matter" hint="Optional — link it to a matter instead of typing.">
          <Select id="pe-matter" name="matterId" defaultValue="">
            <option value="">No case</option>
            {matters.map((m) => (
              <option key={m.id} value={m.id}>{m.reference} — {m.title}</option>
            ))}
          </Select>
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
