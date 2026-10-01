"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { ExtraFieldInput, type FieldSpec } from "./reference-table";
import { withToast } from "@/components/ui/toast";

/** The primary "+ Add X" button in a page's header, opening a right-side form panel. */
export function AddReferenceButton({
  label,
  panelTitle,
  fields = [],
  createAction,
}: {
  label: string;
  panelTitle: string;
  fields?: FieldSpec[];
  createAction: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(createAction(formData), "Added");
      if (result?.error) return setError(result.error);
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </Button>
      <SlideOver open={open} onClose={() => setOpen(false)} title={panelTitle}>
        <form action={create} className="grid gap-4">
          {error && <p className="m-0 text-xs text-danger">{error}</p>}
          <Field label="Name" htmlFor="add-name">
            <Input id="add-name" name="name" required autoFocus />
          </Field>
          {fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`add-${f.key}`}>
              <ExtraFieldInput id={`add-${f.key}`} field={f} />
            </Field>
          ))}
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
