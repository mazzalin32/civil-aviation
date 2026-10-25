"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createContract } from "./actions";
import { withToast } from "@/components/ui/toast";

export function NewContractForm({
  categories,
  lawyers,
}: {
  categories: { id: string; name: string }[];
  lawyers: { id: string; name: string; workload: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(createContract(Object.fromEntries(formData)), "Contract registered");
      if ("error" in result) return setError(result.error);
      router.push(`/contracts/${result.contractId}`);
    });
  }

  return (
    <form action={submit} className="grid gap-x-6 gap-y-5 rounded-card border border-border bg-surface p-7 shadow-card sm:grid-cols-2">
      {error && <p className="m-0 text-xs text-danger sm:col-span-2">{error}</p>}

      <Field label="Contract / agreement title" htmlFor="nc-title" className="sm:col-span-2">
        <Input id="nc-title" name="title" placeholder="e.g. Ground handling services agreement — [counterparty]" autoFocus />
      </Field>

      <Field label="Nature of contract" htmlFor="nc-category" hint="What the contract is about.">
        <Select id="nc-category" name="categoryId" defaultValue="">
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>

      <Field label="Counterparty" htmlFor="nc-counterparty">
        <Input id="nc-counterparty" name="counterpartyName" placeholder="e.g. SkyLink Aviation Services Ltd" />
      </Field>

      <Field label="Requesting / originating department" htmlFor="nc-department">
        <Input id="nc-department" name="originatingDepartment" placeholder="e.g. Airport Operations" />
      </Field>

      <Field label="Date of receipt" htmlFor="nc-received">
        <Input id="nc-received" name="dateOfReceipt" type="date" />
      </Field>

      <Field label="Responsible legal officer" htmlFor="nc-lead" className="sm:col-span-2">
        <Select id="nc-lead" name="leadUserId" defaultValue="">
          <option value="">Select a lawyer</option>
          {lawyers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {l.workload} open case{l.workload === 1 ? "" : "s"}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Commencement date" htmlFor="nc-commence">
        <Input id="nc-commence" name="commencementDate" type="date" />
      </Field>
      <Field label="Expiry date" htmlFor="nc-expiry">
        <Input id="nc-expiry" name="expiryDate" type="date" />
      </Field>

      <div className="flex gap-2 border-t border-border pt-4 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create contract"}
        </Button>
      </div>
    </form>
  );
}
