"use client";

import { useState, useTransition } from "react";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { reassign } from "./actions";

export function ReassignDialog({
  matterId,
  lawyers,
  currentLeadId,
  currentSupportIds,
  open,
  onClose,
}: {
  matterId: string;
  lawyers: { id: string; name: string; workload: number }[];
  currentLeadId?: string;
  currentSupportIds: string[];
  open: boolean;
  onClose: () => void;
}) {
  const [leadId, setLeadId] = useState(currentLeadId ?? "");
  const [supportIds, setSupportIds] = useState<string[]>(currentSupportIds);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function toggleSupport(id: string) {
    setSupportIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await reassign({ matterId, leadUserId: leadId, supportUserIds: supportIds, reason: formData.get("reason") });
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Reassign">
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <Field label="Lead lawyer" htmlFor="ra-lead">
          <Select id="ra-lead" icon={UserCheck} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            {lawyers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.workload} open case{l.workload === 1 ? "" : "s"}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Supporting lawyers</span>
          <div className="grid gap-2 rounded-control border border-border p-3 sm:grid-cols-2">
            {lawyers.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={supportIds.includes(l.id)} disabled={l.id === leadId} onChange={() => toggleSupport(l.id)} className="size-4 accent-primary" />
                {l.name}
                {l.id === leadId && <span className="text-text-muted">(lead)</span>}
              </label>
            ))}
          </div>
        </div>

        <Field label="Reason" htmlFor="ra-reason" hint="Optional — shown in the timeline">
          <textarea
            id="ra-reason"
            name="reason"
            rows={2}
            className="w-full rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          />
        </Field>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending || !leadId}>
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
