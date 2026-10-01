"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { createMatterType } from "./actions";
import { withToast } from "@/components/ui/toast";

export function AddMatterType({ isSubProcess }: { isSubProcess: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(createMatterType(formData), "Added");
      if (result?.error) return setError(result.error);
      setOpen(false);
    });
  }

  const label = isSubProcess ? "Add sub-process template" : "Add matter type";

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </Button>
      <SlideOver open={open} onClose={() => setOpen(false)} title={label}>
        <form action={create} className="grid gap-4">
          <input type="hidden" name="isSubProcess" value={isSubProcess ? "on" : ""} />
          {error && <p className="m-0 text-xs text-danger">{error}</p>}
          <Field label="Name" htmlFor="mt-name">
            <Input id="mt-name" name="name" required autoFocus />
          </Field>
          {!isSubProcess && (
            <Field label="Reference prefix" htmlFor="mt-prefix" hint="e.g. LIT → UCAA/LIT/2026/0042">
              <Input id="mt-prefix" name="referencePrefix" placeholder="LIT" />
            </Field>
          )}
          <Field label="Closure policy" htmlFor="mt-policy">
            <Select id="mt-policy" name="closurePolicy" defaultValue="ADMIN_APPROVAL">
              <option value="ADMIN_APPROVAL">Admin approves closure</option>
              <option value="LAWYER_CLOSES">Lawyer closes directly</option>
            </Select>
          </Field>
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
