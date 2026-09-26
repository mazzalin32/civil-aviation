"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function ReferenceTable({
  items,
  fields = [],
  addLabel,
  createAction,
  updateAction,
  toggleActiveAction,
  moveAction,
}: {
  items: ReferenceItem[];
  fields?: FieldSpec[];
  addLabel: string;
  createAction: (formData: FormData) => Promise<ActionResult>;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  toggleActiveAction: (id: string, isActive: boolean) => Promise<void>;
  moveAction?: (id: string, direction: "up" | "down") => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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
                moveAction={moveAction}
                canMoveUp={i > 0}
                canMoveDown={i < items.length - 1}
              />
            ))}
            {adding && <AddRow fields={fields} createAction={createAction} onDone={() => setAdding(false)} />}
          </tbody>
        </table>
      </div>
      {!adding && (
        <div className="border-t border-border p-3">
          <Button size="sm" onClick={() => setAdding(true)}>
            + {addLabel}
          </Button>
        </div>
      )}
    </Card>
  );
}

function ExtraFieldInput({ field, defaultValue }: { field: FieldSpec; defaultValue?: string }) {
  if (field.type === "select") {
    return (
      <select
        name={field.key}
        defaultValue={defaultValue ?? field.options[0]?.value}
        className="h-9 w-full rounded-none border border-border bg-surface px-2 text-sm"
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return <Input name={field.key} defaultValue={defaultValue} placeholder={field.placeholder} className="h-9" />;
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
  moveAction?: (id: string, direction: "up" | "down") => Promise<void>;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

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
      <td className="border-b border-border px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {moveAction && (
            <>
              <Button
                size="icon"
                aria-label="Move up"
                disabled={!canMoveUp || pending}
                onClick={() => startTransition(() => moveAction(item.id, "up"))}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="icon"
                aria-label="Move down"
                disabled={!canMoveDown || pending}
                onClick={() => startTransition(() => moveAction(item.id, "down"))}
              >
                <ArrowDown className="size-4" />
              </Button>
            </>
          )}
          <Button size="icon" aria-label="Edit" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button size="sm" onClick={() => startTransition(() => toggleActiveAction(item.id, !item.isActive))} disabled={pending}>
            {item.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AddRow({
  fields,
  createAction,
  onDone,
}: {
  fields: FieldSpec[];
  createAction: (formData: FormData) => Promise<ActionResult>;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function create(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createAction(formData);
      if (result?.error) return setError(result.error);
      onDone();
    });
  }

  return (
    <tr className="bg-surface-muted">
      <td className="px-4 py-2" colSpan={fields.length + 3}>
        <form action={create} className="flex flex-wrap items-start gap-2">
          <div className="min-w-[160px] flex-1">
            <Input name="name" placeholder="Name" className="h-9" required autoFocus />
            {error && <p className="m-0 mt-1 text-xs text-danger">{error}</p>}
          </div>
          {fields.map((f) => (
            <div key={f.key} className="min-w-[140px]">
              <ExtraFieldInput field={f} />
            </div>
          ))}
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            <Check className="size-4" /> Add
          </Button>
          <Button type="button" size="sm" onClick={onDone} disabled={pending}>
            <X className="size-4" /> Cancel
          </Button>
        </form>
      </td>
    </tr>
  );
}
