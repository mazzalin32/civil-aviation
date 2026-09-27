"use client";

import { useState, useTransition } from "react";
import { Building2, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { removeParty } from "../actions";
import { PartyFormDialog } from "./party-form-dialog";

export type PartyRow = {
  id: string;
  name: string;
  kind: "OPPOSING" | "WITNESS" | "INTERNAL" | "OTHER";
  counselName: string | null;
  counselFirm: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  department: string | null;
};

const KIND_LABEL = { OPPOSING: "Opposing party", WITNESS: "Witness", INTERNAL: "Internal contact", OTHER: "Other" } as const;

export function PartiesTab({ matterId, parties }: { matterId: string; parties: PartyRow[] }) {
  const [dialog, setDialog] = useState<"add" | PartyRow | null>(null);
  const [pending, startTransition] = useTransition();

  function onRemove(p: PartyRow) {
    if (!window.confirm(`Remove "${p.name}"?`)) return;
    startTransition(async () => {
      await removeParty(matterId, p.id);
    });
  }

  return (
    <div className="grid gap-4">
      <Button type="button" variant="primary" className="justify-self-start" onClick={() => setDialog("add")}>
        <Plus className="size-4" /> Add party
      </Button>

      {parties.length === 0 ? (
        <p className="m-0 text-[13px] text-text-muted">No parties recorded yet.</p>
      ) : (
        <div className="grid gap-3">
          {parties.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 rounded-card border border-border p-4">
              <div className="grid gap-1 text-[13px]">
                <div className="flex items-center gap-2">
                  <b className="font-semibold">{p.name}</b>
                  <Badge tone="neutral">{KIND_LABEL[p.kind]}</Badge>
                </div>
                {(p.counselName || p.counselFirm) && (
                  <p className="m-0 flex items-center gap-1.5 text-text-muted">
                    <Building2 className="size-3.5" /> {[p.counselName, p.counselFirm].filter(Boolean).join(" — ")}
                  </p>
                )}
                {p.email && (
                  <p className="m-0 flex items-center gap-1.5 text-text-muted">
                    <Mail className="size-3.5" /> {p.email}
                  </p>
                )}
                {p.phone && (
                  <p className="m-0 flex items-center gap-1.5 text-text-muted">
                    <Phone className="size-3.5" /> {p.phone}
                  </p>
                )}
                {p.department && <p className="m-0 text-text-muted">Department: {p.department}</p>}
              </div>
              <RowActionsMenu
                actions={[
                  { label: "Edit", icon: Pencil, onClick: () => setDialog(p) },
                  { label: "Remove", icon: Trash2, danger: true, disabled: pending, onClick: () => onRemove(p) },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      <PartyFormDialog matterId={matterId} party={dialog === "add" ? null : dialog} open={dialog !== null} onClose={() => setDialog(null)} />
    </div>
  );
}
