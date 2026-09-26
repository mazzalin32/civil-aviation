"use client";

import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMatterType } from "./actions";

export function AddMatterType({ isSubProcess }: { isSubProcess: boolean }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createMatterType(formData);
      if (result?.error) return setError(result.error);
      setAdding(false);
    });
  }

  if (!adding) {
    return (
      <div className="border-t border-border p-3">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {isSubProcess ? "Add sub-process template" : "Add matter type"}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-surface-muted p-3">
      <form action={create} className="flex flex-wrap items-start gap-2">
        <input type="hidden" name="isSubProcess" value={isSubProcess ? "on" : ""} />
        <div className="min-w-[160px] flex-1">
          <Input name="name" placeholder="Name" className="h-9" required autoFocus />
          {error && <p className="m-0 mt-1 text-xs text-danger">{error}</p>}
        </div>
        {!isSubProcess && <Input name="referencePrefix" placeholder="Prefix e.g. LIT" className="h-9 w-32" />}
        <select name="closurePolicy" defaultValue="ADMIN_APPROVAL" className="h-9 rounded-none border border-border bg-surface px-2 text-sm">
          <option value="ADMIN_APPROVAL">Admin approves closure</option>
          <option value="LAWYER_CLOSES">Lawyer closes directly</option>
        </select>
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          <Check className="size-4" /> Add
        </Button>
        <Button type="button" size="sm" onClick={() => setAdding(false)} disabled={pending}>
          <X className="size-4" /> Cancel
        </Button>
      </form>
    </div>
  );
}
