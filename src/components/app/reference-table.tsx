"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Ban, CheckCircle2, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { cn } from "@/lib/utils";

export type FieldSpec =
  | { key: string; label: string; type: "text"; placeholder?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] };

export type ReferenceItem = {
  id: string;
  name: string;
  isActive: boolean;
  extra: Record<string, string>;
};

type ActionResult = { error?: string } | void;

/** The add trigger lives in the page's own PageHeader now (see AddReferenceButton) — this is just the table. */
export function ReferenceTable({
  items,
  fields = [],
  updateAction,
  toggleActiveAction,
  deleteAction,
  moveAction,
}: {
  items: ReferenceItem[];
  fields?: FieldSpec[];
  updateAction: (formData: FormData) => Promise<ActionResult>;
  toggleActiveAction: (id: string, isActive: boolean) => Promise<void>;
  deleteAction?: (id: string) => Promise<{ error?: string } | void>;
  moveAction?: (id: string, direction: "up" | "down") => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Name</th>
              {fields.map((f) => (
                <th key={f.key} className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">
                  {f.label}
                </th>
              ))}
              <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Status</th>
              <th className="border-b border-border px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <Row
                key={item.id}
                item={item}
                fields={fields}
                editing={editingId === item.id}
                onEdit={() => setEditingId(item.id)}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
                updateAction={updateAction}
                toggleActiveAction={toggleActiveAction}
                deleteAction={deleteAction}
                moveAction={moveAction}
                canMoveUp={i > 0}
                canMoveDown={i < items.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ExtraFieldInput({ field, defaultValue, id }: { field: FieldSpec; defaultValue?: string; id?: string }) {
  if (field.type === "select") {
    return (
      <select
        id={id}
        name={field.key}
        defaultValue={defaultValue ?? field.options[0]?.value}
        className="h-10 w-full rounded-none border border-border bg-surface px-3 text-sm"
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return <Input id={id} name={field.key} defaultValue={defaultValue} placeholder={field.placeholder} />;
}

function Row({
  item,
  fields,
  editing,
  onEdit,
  onCancel,
  onSaved,
  updateAction,
  toggleActiveAction,
  deleteAction,
  moveAction,
  canMoveUp,
  canMoveDown,
}: {
  item: ReferenceItem;
  fields: FieldSpec[];
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  toggleActiveAction: (id: string, isActive: boolean) => Promise<void>;
  deleteAction?: (id: string) => Promise<{ error?: string } | void>;
  moveAction?: (id: string, direction: "up" | "down") => Promise<void>;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onDelete() {
    if (!deleteAction) return;
    if (!window.confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteAction(item.id);
      if (result?.error) window.alert(result.error);
    });
  }

  function save(formData: FormData) {
    formData.set("id", item.id);
    setError(undefined);
    startTransition(async () => {
      const result = await updateAction(formData);
      if (result?.error) return setError(result.error);
      onSaved();
    });
  }

  if (editing) {
    return (
      <tr className="bg-primary-soft/40">
        <td className="border-b border-border px-4 py-2" colSpan={fields.length + 3}>
          <form action={save} className="flex flex-wrap items-start gap-2">
            <div className="min-w-[160px] flex-1">
              <Input name="name" defaultValue={item.name} className="h-9" required />
              {error && <p className="m-0 mt-1 text-xs text-danger">{error}</p>}
            </div>
            {fields.map((f) => (
              <div key={f.key} className="min-w-[140px]">
                <ExtraFieldInput field={f} defaultValue={item.extra[f.key]} />
              </div>
            ))}
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
              <Check className="size-4" /> Save
            </Button>
            <Button type="button" size="sm" onClick={onCancel} disabled={pending}>
              <X className="size-4" /> Cancel
            </Button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className={cn(!item.isActive && "opacity-60")}>
      <td className="border-b border-border px-4 py-2.5 font-medium">{item.name}</td>
      {fields.map((f) => (
        <td key={f.key} className="border-b border-border px-4 py-2.5 text-text-muted">
          {f.type === "select" ? (f.options.find((o) => o.value === item.extra[f.key])?.label ?? item.extra[f.key]) : item.extra[f.key]}
        </td>
      ))}
      <td className="border-b border-border px-4 py-2.5">
        <Badge tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "Active" : "Deactivated"}</Badge>
      </td>
      <td className="border-b border-border px-4 py-2.5 text-right">
        <RowActionsMenu
          actions={[
            { label: "Edit", icon: Pencil, onClick: onEdit },
            ...(moveAction
              ? ([
                  { label: "Move up", icon: ArrowUp, disabled: !canMoveUp || pending, onClick: () => startTransition(() => moveAction(item.id, "up")) },
                  {
                    label: "Move down",
                    icon: ArrowDown,
                    disabled: !canMoveDown || pending,
                    onClick: () => startTransition(() => moveAction(item.id, "down")),
                  },
                ] as const)
              : []),
            { kind: "separator" },
            {
              label: item.isActive ? "Deactivate" : "Reactivate",
              icon: item.isActive ? Ban : CheckCircle2,
              danger: item.isActive,
              disabled: pending,
              onClick: () => startTransition(() => toggleActiveAction(item.id, !item.isActive)),
            },
            ...(deleteAction ? [{ label: "Delete", icon: Trash2, danger: true, disabled: pending, onClick: onDelete }] : []),
          ]}
        />
      </td>
    </tr>
  );
}
