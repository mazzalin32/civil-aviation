"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SlideOver } from "@/components/ui/slide-over";
import { addTask } from "../cases/[id]/tabs/tasks-actions";

/**
 * "New task" on the Tasks page. Admins can create a task on any case; a lawyer sees only the
 * cases they lead. Either way the task can be handed to anyone in the department — the server
 * re-checks that the caller is the Admin or the case's Lead (requireTaskAssign).
 */
export function NewTask({
  matters,
  people,
  currentUserId,
}: {
  matters: { id: string; reference: string; title: string }[];
  people: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [matterId, setMatterId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function close() {
    setOpen(false);
    setError(undefined);
  }

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await addTask({ matterId, title: formData.get("title"), assigneeId, dueAt: formData.get("dueAt") });
      if (result?.error) return setError(result.error);
      setMatterId("");
      setAssigneeId("");
      close();
    });
  }

  return (
    <>
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New task
      </Button>

      <SlideOver open={open} onClose={close} title="New task">
        <form action={submit} className="grid gap-1">
          {error && (
            <p className="m-0 mb-2 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <Field label="Case" htmlFor="nt-matter">
            <Select id="nt-matter" value={matterId} onChange={(e) => setMatterId(e.target.value)}>
              <option value="">Choose a case…</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.reference} — {m.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Task" htmlFor="nt-title">
            <Input id="nt-title" name="title" required placeholder="e.g. Draft witness statement" />
          </Field>
          <Field label="Assign to" htmlFor="nt-assignee" hint="Anyone in the department.">
            <Select id="nt-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Choose a person…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === currentUserId ? " (me)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="nt-due">
            <Input id="nt-due" name="dueAt" type="date" required />
          </Field>
          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="submit" variant="primary" disabled={pending || !matterId || !assigneeId}>
              {pending ? "Creating…" : "Create task"}
            </Button>
            <Button type="button" onClick={close} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
