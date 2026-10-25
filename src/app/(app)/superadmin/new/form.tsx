"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOrganization } from "../actions";
import { withToast } from "@/components/ui/toast";

export function NewOrganizationForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(createOrganization(Object.fromEntries(formData)), "Organisation created");
      if (result && "error" in result) return setError(result.error);
      if (result && "organizationId" in result) router.push(`/superadmin/${result.organizationId}`);
    });
  }

  return (
    <form action={submit} className="grid gap-4 rounded-card border border-border bg-surface p-6 shadow-card">
      {error && <p className="m-0 text-xs text-danger">{error}</p>}

      <Field label="Organisation name" htmlFor="org-name">
        <Input id="org-name" name="name" placeholder="e.g. Uganda Civil Aviation Authority" autoFocus />
      </Field>

      <Field label="Logo URL" htmlFor="org-logo" hint="Optional — a link to the organisation's logo image. Leave blank to use the default.">
        <Input id="org-logo" name="logoUrl" type="url" placeholder="https://…" />
      </Field>

      <Field label="Primary colour" htmlFor="org-color" hint="Optional — hex colour, e.g. #4169E1. Leave blank to use the platform default.">
        <Input id="org-color" name="primaryColor" placeholder="#4169E1" />
      </Field>

      <div className="flex gap-2 border-t border-border pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create organisation"}
        </Button>
      </div>
    </form>
  );
}
