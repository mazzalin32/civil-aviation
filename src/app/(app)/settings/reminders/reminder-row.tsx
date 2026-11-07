"use client";

import { useState, useTransition } from "react";
import { Check, Lock, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { updateReminderRule } from "./actions";
import { withToast } from "@/components/ui/toast";

export type ReminderRuleRow = { id: string; label: string; offsets: number[]; offsetUnit: string; channels: string[]; mutable: boolean };

/** "7d", "same day", "1d after" — or "10 min" for the chat email delay. */
function offsetLabel(o: number, unit: string) {
  if (unit === "MINUTES") return `${o} min`;
  if (o === 0) return "same day";
  return o > 0 ? `${o}d` : `${-o}d after`;
}

const CHANNELS = [
  { value: "IN_APP", label: "In-app" },
  { value: "EMAIL", label: "Email" },
];

export function ReminderRow({ rule }: { rule: ReminderRuleRow }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function save(formData: FormData) {
    formData.set("id", rule.id);
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(updateReminderRule(formData), "Reminder rule saved");
      if (result?.error) return setError(result.error);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <tr className="bg-primary-soft/40">
        <td className="border-b border-border px-4 py-3 font-medium">{rule.label}</td>
        <td className="border-b border-border px-4 py-3" colSpan={3}>
          <form action={save} className="flex flex-wrap items-start gap-3">
            <div className="min-w-[160px]">
              <label className="mb-1 block text-xs text-text-muted">
                {rule.offsetUnit === "MINUTES" ? "Minutes to wait" : "Days before (negative = after; comma-separated; 0 = same day)"}
              </label>
              <Input name="offsets" defaultValue={rule.offsets.join(", ")} className="h-9" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Channels</label>
              <div className="flex gap-3 pt-1.5">
                {CHANNELS.map((c) => (
                  <label key={c.value} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="channels" value={c.value} defaultChecked={rule.channels.includes(c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="m-0 w-full text-xs text-danger">{error}</p>}
            <div className="flex gap-2 pt-5">
              <Button type="submit" size="sm" variant="primary" disabled={pending}>
                <Check className="size-4" /> Save
              </Button>
              <Button type="button" size="sm" onClick={() => setEditing(false)} disabled={pending}>
                <X className="size-4" /> Cancel
              </Button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="border-b border-border px-4 py-3 font-medium">{rule.label}</td>
      <td className="border-b border-border px-4 py-3 text-text-muted">{rule.offsets.map((o) => offsetLabel(o, rule.offsetUnit)).join(", ")}</td>
      <td className="border-b border-border px-4 py-3 text-text-muted">{rule.channels.map((c) => CHANNELS.find((x) => x.value === c)?.label ?? c).join(", ")}</td>
      <td className="border-b border-border px-4 py-3">
        {rule.mutable ? (
          <Badge tone="neutral">Lawyer can mute</Badge>
        ) : (
          <Badge tone="warning">
            <Lock className="size-3" /> Always on
          </Badge>
        )}
      </td>
      <td className="border-b border-border px-4 py-3 text-right">
        <Button size="icon" aria-label="Edit" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
      </td>
    </tr>
  );
}
