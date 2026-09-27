"use client";

import { useState, useTransition } from "react";
import { User, Building2, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { addParty, updateParty } from "../actions";
import type { PartyRow } from "./parties-tab";

export function PartyFormDialog({
  matterId,
  party,
  open,
  onClose,
}: {
  matterId: string;
  party: PartyRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    formData.set("matterId", matterId);
    if (party) formData.set("id", party.id);
    startTransition(async () => {
      const result = await (party ? updateParty : addParty)(Object.fromEntries(formData));
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title={party ? "Edit party" : "Add party"}>
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <Field label="Kind" htmlFor="pt-kind">
          <Select id="pt-kind" name="kind" defaultValue={party?.kind ?? "OPPOSING"}>
            <option value="OPPOSING">Opposing party</option>
            <option value="WITNESS">Witness</option>
            <option value="INTERNAL">Internal UCAA contact</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Name" htmlFor="pt-name">
          <Input id="pt-name" name="name" icon={User} defaultValue={party?.name ?? ""} required autoFocus />
        </Field>
        <Field label="Counsel name" htmlFor="pt-counsel-name">
          <Input id="pt-counsel-name" name="counselName" defaultValue={party?.counselName ?? ""} />
        </Field>
        <Field label="Counsel firm" htmlFor="pt-counsel-firm">
          <Input id="pt-counsel-firm" name="counselFirm" icon={Building2} defaultValue={party?.counselFirm ?? ""} />
        </Field>
        <Field label="Email" htmlFor="pt-email">
          <Input id="pt-email" name="email" type="email" icon={Mail} defaultValue={party?.email ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="pt-phone">
          <Input id="pt-phone" name="phone" icon={Phone} defaultValue={party?.phone ?? ""} />
        </Field>
        <Field label="Address" htmlFor="pt-address">
          <Input id="pt-address" name="address" icon={MapPin} defaultValue={party?.address ?? ""} />
        </Field>
        <Field label="Department" htmlFor="pt-department" hint="Internal contacts only">
          <Input id="pt-department" name="department" icon={Building2} defaultValue={party?.department ?? ""} />
        </Field>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}
