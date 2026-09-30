"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { EmptyState } from "@/components/app/empty-state";
import { addResourceLink, deleteResourceLink } from "./actions";

export type ResourceLinkRow = {
  id: string;
  title: string;
  url: string;
  category: string | null;
  addedByName: string;
};

export function LinksView({ links, isAdmin }: { links: ResourceLinkRow[]; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await addResourceLink({ title: formData.get("title"), url: formData.get("url"), category: formData.get("category") });
      if (result?.error) return setError(result.error);
      setOpen(false);
    });
  }

  function onDelete(l: ResourceLinkRow) {
    if (!window.confirm(`Remove "${l.title}"?`)) return;
    startTransition(async () => {
      await deleteResourceLink(l.id);
    });
  }

  const groups = new Map<string, ResourceLinkRow[]>();
  for (const l of links) {
    const key = l.category || "General";
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  return (
    <>
      <Button type="button" variant="primary" className="mb-4 justify-self-start" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add link
      </Button>

      {links.length === 0 ? (
        <EmptyState icon={Link2} title="No links yet" description="Add quick-reference links to statutes, court portals or other resources the team uses often." />
      ) : (
        <div className="grid gap-4">
          {[...groups.entries()].map(([category, rows]) => (
            <div key={category}>
              <h3 className="m-0 mb-2 text-[13px] font-semibold text-text-muted uppercase">{category}</h3>
              <Card className="overflow-hidden">
                <div className="grid divide-y divide-border">
                  {rows.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                      <Link2 className="size-4 shrink-0 text-text-muted" />
                      <a href={l.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13px] font-medium text-primary hover:underline">
                        {l.title}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                      <span className="shrink-0 text-xs text-text-muted">Added by {l.addedByName}</span>
                      {isAdmin && <RowActionsMenu actions={[{ label: "Remove", icon: Trash2, danger: true, disabled: pending, onClick: () => onDelete(l) }]} />}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <SlideOver open={open} onClose={() => setOpen(false)} title="Add link">
        <form action={submit} className="grid gap-4">
          {error && <p className="m-0 text-[13px] text-danger">{error}</p>}
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" required placeholder="e.g. Judicature Act" />
          </Field>
          <Field label="URL" htmlFor="url">
            <Input id="url" name="url" type="url" required placeholder="https://…" />
          </Field>
          <Field label="Category" htmlFor="category" hint="Optional — groups links together">
            <Input id="category" name="category" placeholder="e.g. Statutes" />
          </Field>
          <Button type="submit" variant="primary" disabled={pending} className="justify-self-start">
            {pending ? "Adding…" : "Add link"}
          </Button>
        </form>
      </SlideOver>
    </>
  );
}
