"use client";

import { useState, useTransition } from "react";
import { Building2, Mail, MapPin, Phone, Plus, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { EmptyState } from "@/components/app/empty-state";
import { saveLawFirm, setLawFirmActive } from "./actions";

export type LawFirmRow = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
};

export function LawFirmsView({ firms, isAdmin }: { firms: LawFirmRow[]; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LawFirmRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function openNew() {
    setEditing(null);
    setError(undefined);
    setOpen(true);
  }
  function openEdit(f: LawFirmRow) {
    setEditing(f);
    setError(undefined);
    setOpen(true);
  }

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await saveLawFirm({
        id: editing?.id,
        name: formData.get("name"),
        contactName: formData.get("contactName"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        address: formData.get("address"),
        notes: formData.get("notes"),
      });
      if (result?.error) return setError(result.error);
      setOpen(false);
    });
  }

  function toggleActive(f: LawFirmRow) {
    startTransition(async () => {
      await setLawFirmActive(f.id, !f.isActive);
    });
  }

  const active = firms.filter((f) => f.isActive);
  const inactive = firms.filter((f) => !f.isActive);

  return (
    <>
      {isAdmin && (
        <Button type="button" variant="primary" className="mb-4 justify-self-start" onClick={openNew}>
          <Plus className="size-4" /> Add law firm
        </Button>
      )}

      {firms.length === 0 ? (
        <EmptyState icon={Building2} title="No law firms yet" description={isAdmin ? "Add outside counsel and firms the department deals with, so anyone can look up contact details." : "No outside counsel or firms have been added yet."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...active, ...inactive].map((f) => (
            <Card key={f.id} className={f.isActive ? "" : "opacity-60"}>
              <div className="flex items-start justify-between gap-2 p-5">
                <div className="min-w-0">
                  <b className="block truncate text-[14px] font-semibold">{f.name}</b>
                  {f.contactName && <p className="m-0 mt-0.5 text-xs text-text-muted">{f.contactName}</p>}
                  <div className="mt-2 grid gap-1 text-xs text-text-muted">
                    {f.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5 shrink-0" /> {f.phone}
                      </span>
                    )}
                    {f.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3.5 shrink-0" /> {f.email}
                      </span>
                    )}
                    {f.address && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" /> {f.address}
                      </span>
                    )}
                  </div>
                  {f.notes && <p className="m-0 mt-2 text-xs text-text-muted">{f.notes}</p>}
                </div>
                <RowActionsMenu
                  actions={[
                    { label: "Edit", icon: Building2, onClick: () => openEdit(f) },
                    ...(isAdmin
                      ? [
                          f.isActive
                            ? { label: "Deactivate", icon: XCircle, danger: true, disabled: pending, onClick: () => toggleActive(f) }
                            : { label: "Reactivate", icon: RotateCcw, disabled: pending, onClick: () => toggleActive(f) },
                        ]
                      : []),
                  ]}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <SlideOver open={open} onClose={() => setOpen(false)} title={editing ? "Edit law firm" : "Add law firm"}>
        <form action={submit} className="grid gap-4">
          {error && <p className="m-0 text-[13px] text-danger">{error}</p>}
          <Field label="Firm name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={editing?.name} />
          </Field>
          <Field label="Contact person" htmlFor="contactName" hint="Optional">
            <Input id="contactName" name="contactName" defaultValue={editing?.contactName ?? ""} />
          </Field>
          <Field label="Phone" htmlFor="phone" hint="Optional">
            <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
          </Field>
          <Field label="Email" htmlFor="email" hint="Optional">
            <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
          </Field>
          <Field label="Address" htmlFor="address" hint="Optional">
            <Input id="address" name="address" defaultValue={editing?.address ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes" hint="Optional">
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={editing?.notes ?? ""}
              className="w-full rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            />
          </Field>
          <Button type="submit" variant="primary" disabled={pending} className="justify-self-start">
            {pending ? "Saving…" : editing ? "Save changes" : "Add firm"}
          </Button>
        </form>
      </SlideOver>
    </>
  );
}
