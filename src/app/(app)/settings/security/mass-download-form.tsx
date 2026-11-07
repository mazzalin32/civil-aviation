"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { withToast } from "@/components/ui/toast";
import type { MassDownloadPolicy } from "@/lib/security/policy";
import { updateMassDownloadPolicy } from "./actions";

export function MassDownloadForm({ policy }: { policy: MassDownloadPolicy }) {
  const [autoLock, setAutoLock] = useState(policy.autoLock);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setErrors({});
    startTransition(async () => {
      const result = await withToast(
        updateMassDownloadPolicy({ files: formData.get("files"), minutes: formData.get("minutes"), autoLock }),
        "Security settings saved",
      );
      if (result.fieldErrors) setErrors(result.fieldErrors);
    });
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Different files" htmlFor="files" error={errors.files} hint="Opened, downloaded or printed by one person">
          <Input id="files" name="files" type="number" inputMode="numeric" min={5} defaultValue={policy.files} required />
        </Field>
        <Field label="Within (minutes)" htmlFor="minutes" error={errors.minutes} hint="Counted over this rolling window">
          <Input id="minutes" name="minutes" type="number" inputMode="numeric" min={1} defaultValue={policy.minutes} required />
        </Field>
      </div>
      <div className="flex items-start gap-3 rounded-control border border-border p-4">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold">Lock the account automatically</p>
          <p className="m-0 mt-0.5 text-[13px] text-text-muted">
            Deactivates the lawyer&apos;s account and signs them out everywhere, until an Admin re-activates it from Users. Admin accounts are never
            locked automatically. Leave off to only be alerted — a lawyer preparing a court bundle can legitimately download many files.
          </p>
        </div>
        <Switch checked={autoLock} onCheckedChange={setAutoLock} label="Lock the account automatically" className="mt-1" />
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          <Check /> Save
        </Button>
      </div>
    </form>
  );
}
