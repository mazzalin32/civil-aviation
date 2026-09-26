"use client";

import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddStage({ createAction }: { createAction: (formData: FormData) => Promise<{ error?: string } | void> }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createAction(formData);
      if (result?.error) return setError(result.error);
      setAdding(false);
    });
  }

  if (!adding) {
    return (
      <div className="border-t border-border p-3">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add stage
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-surface-muted p-3">
      <form action={create} className="grid gap-2">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-[160px] flex-1">
            <Input name="name" placeholder="Stage name" className="h-9" required autoFocus />
            {error && <p className="m-0 mt-1 text-xs text-danger">{error}</p>}
          </div>
          <Input name="description" placeholder="Description (optional)" className="h-9 flex-1" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input name="requiredFields" placeholder="Required fields, e.g. filingDate, serviceDate" className="h-9 flex-1" />
          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <input type="checkbox" name="allowsClosure" />
            Allows closure from here
          </label>
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            <Check className="size-4" /> Add
          </Button>
          <Button type="button" size="sm" onClick={() => setAdding(false)} disabled={pending}>
            <X className="size-4" /> Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
