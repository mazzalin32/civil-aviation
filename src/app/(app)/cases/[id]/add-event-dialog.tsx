"use client";

import { useState, useTransition } from "react";
import { Tag, FileText, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { addEvent } from "./actions";

export function AddEventDialog({
  matterId,
  eventTypes,
  open,
  onClose,
}: {
  matterId: string;
  eventTypes: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await addEvent({
        matterId,
        typeId: formData.get("typeId"),
        title: formData.get("title"),
        description: formData.get("description"),
        date: formData.get("date"),
      });
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Add event">
      <form action={create} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <Field label="Event type" htmlFor="ev-type">
          <Select id="ev-type" name="typeId" icon={Tag} required>
            <option value="">Choose…</option>
            {eventTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="ev-title">
          <Input id="ev-title" name="title" icon={FileText} required autoFocus placeholder="e.g. Reply to defence filed" />
        </Field>
        <Field label="Date" htmlFor="ev-date">
          <Input id="ev-date" name="date" type="date" icon={CalendarClock} required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Description" htmlFor="ev-desc" hint="Optional — what happened, who was involved">
          <textarea
            id="ev-desc"
            name="description"
            rows={3}
            className="w-full rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          />
        </Field>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Adding…" : "Add event"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}
