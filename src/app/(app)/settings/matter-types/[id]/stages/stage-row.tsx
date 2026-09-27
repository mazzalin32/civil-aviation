"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Ban, Check, CheckCircle2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { cn } from "@/lib/utils";

export type StageRow = {
  id: string;
  name: string;
  description: string | null;
  allowsClosure: boolean;
  requiredFields: string[];
  isActive: boolean;
};

type ActionResult = { error?: string } | void;

export function StageRowItem({
  stage,
  position,
  canMoveUp,
  canMoveDown,
  updateAction,
  toggleActiveAction,
  moveAction,
}: {
  stage: StageRow;
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  toggleActiveAction: (isActive: boolean) => Promise<void>;
  moveAction: (direction: "up" | "down") => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function save(formData: FormData) {
    formData.set("id", stage.id);
    setError(undefined);
    startTransition(async () => {
      const result = await updateAction(formData);
      if (result?.error) return setError(result.error);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <tr className="bg-primary-soft/40">
        <td className="border-b border-border px-4 py-2.5" colSpan={5}>
          <form action={save} className="grid gap-2">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-[160px] flex-1">
                <Input name="name" defaultValue={stage.name} className="h-9" required />
                {error && <p className="m-0 mt-1 text-xs text-danger">{error}</p>}
              </div>
              <Input name="description" defaultValue={stage.description ?? ""} placeholder="Description (optional)" className="h-9 flex-1" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                name="requiredFields"
                defaultValue={stage.requiredFields.join(", ")}
                placeholder="Required fields, e.g. filingDate, serviceDate"
                className="h-9 flex-1"
              />
              <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                <input type="checkbox" name="allowsClosure" defaultChecked={stage.allowsClosure} />
                Allows closure from here
              </label>
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
    <tr className={cn(!stage.isActive && "opacity-60")}>
      <td className="border-b border-border px-4 py-2.5 text-text-muted tabular-nums">{position}</td>
      <td className="border-b border-border px-4 py-2.5 font-medium">
        {stage.name}
        {stage.description && <span className="block text-xs font-normal text-text-muted">{stage.description}</span>}
      </td>
      <td className="border-b border-border px-4 py-2.5">{stage.allowsClosure && <Badge tone="info">Allows closure</Badge>}</td>
      <td className="border-b border-border px-4 py-2.5">
        <Badge tone={stage.isActive ? "success" : "neutral"}>{stage.isActive ? "Active" : "Deactivated"}</Badge>
      </td>
      <td className="border-b border-border px-4 py-2.5 text-right">
        <RowActionsMenu
          actions={[
            { label: "Edit", icon: Pencil, onClick: () => setEditing(true) },
            { label: "Move up", icon: ArrowUp, disabled: !canMoveUp || pending, onClick: () => startTransition(() => moveAction("up")) },
            { label: "Move down", icon: ArrowDown, disabled: !canMoveDown || pending, onClick: () => startTransition(() => moveAction("down")) },
            { kind: "separator" },
            {
              label: stage.isActive ? "Deactivate" : "Reactivate",
              icon: stage.isActive ? Ban : CheckCircle2,
              danger: stage.isActive,
              disabled: pending,
              onClick: () => startTransition(() => toggleActiveAction(!stage.isActive)),
            },
          ]}
        />
      </td>
    </tr>
  );
}
