"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { withToast } from "@/components/ui/toast";

export function AddStage({ createAction }: { createAction: (formData: FormData) => Promise<{ error?: string } | void> }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(createAction(formData), "Stage added");
      if (result?.error) return setError(result.error);
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add stage
      </Button>
      <SlideOver open={open} onClose={() => setOpen(false)} title="Add stage">
        <form action={create} className="grid gap-4">
          {error && <p className="m-0 text-xs text-danger">{error}</p>}
          <Field label="Stage name" htmlFor="st-name">
            <Input id="st-name" name="name" required autoFocus />
          </Field>
          <Field label="Description" htmlFor="st-description" hint="Optional">
            <Input id="st-description" name="description" />
          </Field>
          <Field label="Required fields" htmlFor="st-fields" hint="Comma-separated keys, e.g. filingDate, serviceDate">
            <Input id="st-fields" name="requiredFields" placeholder="filingDate, serviceDate" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowsClosure" />
            Allows closure from here
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </Button>
            <Button type="button" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
