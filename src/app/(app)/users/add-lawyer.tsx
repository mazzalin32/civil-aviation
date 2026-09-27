"use client";

import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { createLawyer } from "./actions";

export function AddLawyer() {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createLawyer(formData);
      if (result?.error) return setError(result.error);
      setAdding(false);
    });
  }

  if (!adding) {
    return (
      <div className="border-b border-border p-3">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add lawyer
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-surface-muted p-4">
      <form action={create} className="grid gap-3">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" required autoFocus />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" placeholder="+256 7XX XXX XXX" />
          </Field>
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" placeholder="e.g. Legal Officer" />
          </Field>
          <Field label="Department" htmlFor="department">
            <Input id="department" name="department" defaultValue="Legal" />
          </Field>
          <Field label="Practising certificate no." htmlFor="practisingCertNo">
            <Input id="practisingCertNo" name="practisingCertNo" />
          </Field>
          <Field label="Certificate expiry" htmlFor="certExpiry">
            <Input id="certExpiry" name="certExpiry" type="date" />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            <Check className="size-4" /> {pending ? "Sending invite…" : "Add & send invite"}
          </Button>
          <Button type="button" size="sm" onClick={() => setAdding(false)} disabled={pending}>
            <X className="size-4" /> Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
