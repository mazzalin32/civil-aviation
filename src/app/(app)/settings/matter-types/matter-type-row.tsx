"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ListTree, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toggleMatterTypeActive, updateMatterType } from "./actions";

export type MatterTypeRow = {
  id: string;
  name: string;
  referencePrefix: string | null;
  closurePolicy: "ADMIN_APPROVAL" | "LAWYER_CLOSES";
  isActive: boolean;
  stageCount: number;
};

export function MatterTypeRowItem({ item }: { item: MatterTypeRow }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function save(formData: FormData) {
    formData.set("id", item.id);
    setError(undefined);
    startTransition(async () => {
      const result = await updateMatterType(formData);
      if (result?.error) return setError(result.error);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <tr className="bg-primary-soft/40">
        <td className="border-b border-border px-4 py-2.5" colSpan={5}>
          <form action={save} className="flex flex-wrap items-start gap-2">
            <div className="min-w-[160px] flex-1">
              <Input name="name" defaultValue={item.name} className="h-9" required />
              {error && <p className="m-0 mt-1 text-xs text-danger">{error}</p>}
            </div>
            <Input name="referencePrefix" defaultValue={item.referencePrefix ?? ""} placeholder="Prefix e.g. LIT" className="h-9 w-32" />
            <select name="closurePolicy" defaultValue={item.closurePolicy} className="h-9 rounded-none border border-border bg-surface px-2 text-sm">
              <option value="ADMIN_APPROVAL">Admin approves closure</option>
              <option value="LAWYER_CLOSES">Lawyer closes directly</option>
            </select>
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
              <Check className="size-4" /> Save
            </Button>
            <Button type="button" size="sm" onClick={() => setEditing(false)} disabled={pending}>
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
      <td className="border-b border-border px-4 py-2.5 text-text-muted">{item.referencePrefix ?? "—"}</td>
      <td className="border-b border-border px-4 py-2.5 text-text-muted">
        {item.closurePolicy === "ADMIN_APPROVAL" ? "Admin approves" : "Lawyer closes"}
      </td>
      <td className="border-b border-border px-4 py-2.5">
        <Badge tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "Active" : "Deactivated"}</Badge>
      </td>
      <td className="border-b border-border px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/settings/matter-types/${item.id}/stages`}
            className="mr-1 inline-flex items-center gap-1.5 rounded-control border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-muted"
          >
            <ListTree className="size-3.5" /> {item.stageCount} stage{item.stageCount === 1 ? "" : "s"}
          </Link>
          <Button size="icon" aria-label="Edit" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button size="sm" onClick={() => startTransition(() => toggleMatterTypeActive(item.id, !item.isActive))} disabled={pending}>
            {item.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </td>
    </tr>
  );
}
