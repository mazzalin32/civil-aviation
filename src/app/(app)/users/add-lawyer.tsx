"use client";

import { useState, useTransition } from "react";
import { Plus, User, Mail, Phone, Briefcase, Building2, BadgeCheck, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { SlideOver } from "@/components/ui/slide-over";
import { createLawyer } from "./actions";
import { withToast } from "@/components/ui/toast";

export function AddLawyer({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(createLawyer(formData), "Invitation sent");
      if (result?.error) return setError(result.error);
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add lawyer
      </Button>
      <SlideOver open={open} onClose={() => setOpen(false)} title="Add lawyer">
        <form action={create} className="grid gap-7">
          {error && <p className="m-0 text-xs text-danger">{error}</p>}

          <FormSection step={1} title="Contact information">
            <Field label="Full name" htmlFor="lw-name" className="sm:col-span-2">
              <Input id="lw-name" name="name" icon={User} required autoFocus />
            </Field>
            <Field label="Email" htmlFor="lw-email">
              <Input id="lw-email" name="email" type="email" icon={Mail} required />
            </Field>
            <Field label="Phone" htmlFor="lw-phone">
              <Input id="lw-phone" name="phone" icon={Phone} placeholder="+256 7XX XXX XXX" />
            </Field>
          </FormSection>

          <FormSection step={2} title="Professional details">
            <Field label="Title" htmlFor="lw-title">
              <Input id="lw-title" name="title" icon={Briefcase} placeholder="e.g. Legal Officer" />
            </Field>
            <Field label="Department" htmlFor="lw-department">
              <Input id="lw-department" name="department" icon={Building2} defaultValue="Legal" />
            </Field>
            <Field label="Practising certificate no." htmlFor="lw-cert">
              <Input id="lw-cert" name="practisingCertNo" icon={BadgeCheck} />
            </Field>
            <Field label="Certificate expiry" htmlFor="lw-expiry">
              <Input id="lw-expiry" name="certExpiry" type="date" icon={CalendarClock} />
            </Field>
          </FormSection>

          <div className="flex gap-2 border-t border-border pt-5">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Sending invite…" : "Add & send invite"}
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
