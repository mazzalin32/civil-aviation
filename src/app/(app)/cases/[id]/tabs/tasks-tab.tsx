"use client";

import { useState, useTransition } from "react";
import { Ban, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { addTask, completeTask, deleteTask, markTaskNotApplicable, reopenTask } from "./tasks-actions";

export type TaskRow = {
  id: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  dueAt: string;
  doneAt: string | null;
  status: "OPEN" | "DONE" | "NA";
  naReason: string | null;
};

export function TasksTab({
  matterId,
  tasks,
  teamMembers,
  currentUserId,
  canMutate,
}: {
  matterId: string;
  tasks: TaskRow[];
  teamMembers: { id: string; name: string }[];
  currentUserId: string;
  /** Case Lead or Admin — can assign new tasks and manage anyone's (reopen/NA/delete). */
  canMutate: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submitNew(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await addTask({ matterId, title: formData.get("title"), assigneeId: formData.get("assigneeId"), dueAt: formData.get("dueAt") });
      if (result?.error) setError(result.error);
    });
  }

  function onComplete(t: TaskRow) {
    startTransition(async () => {
      await completeTask(matterId, t.id);
    });
  }
  function onReopen(t: TaskRow) {
    startTransition(async () => {
      await reopenTask(matterId, t.id);
    });
  }
  function onNA(t: TaskRow) {
    const reason = window.prompt(`Why isn't "${t.title}" applicable?`);
    if (!reason) return;
    startTransition(async () => {
      const result = await markTaskNotApplicable(matterId, t.id, { reason });
      if (result?.error) window.alert(result.error);
    });
  }
  function onDelete(t: TaskRow) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    startTransition(async () => {
      await deleteTask(matterId, t.id);
    });
  }

  const open = tasks.filter((t) => t.status === "OPEN");
  const done = tasks.filter((t) => t.status !== "OPEN");

  return (
    <div className="grid gap-6">
      {canMutate && (
      <form action={submitNew} className="flex flex-wrap items-end gap-2 rounded-card border border-border p-4">
        {error && <p className="m-0 w-full text-xs text-danger">{error}</p>}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-[13px] font-medium">Title</label>
          <Input name="title" required placeholder="e.g. Draft witness statement" />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">Assignee</label>
          <Select name="assigneeId" required className="w-[180px]">
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">Due</label>
          <Input name="dueAt" type="date" required className="w-[160px]" />
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          <Plus className="size-4" /> Add task
        </Button>
      </form>
      )}

      {tasks.length === 0 ? (
        <p className="m-0 text-[13px] text-text-muted">No tasks yet.</p>
      ) : (
        <div className="grid gap-2">
          {[...open, ...done].map((t) => {
            const overdue = t.status === "OPEN" && new Date(t.dueAt) < new Date();
            const canToggle = canMutate || t.assigneeId === currentUserId;
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-card border border-border p-3">
                <button
                  type="button"
                  onClick={() => canToggle && (t.status === "OPEN" ? onComplete(t) : onReopen(t))}
                  disabled={pending || !canToggle}
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border-2",
                    t.status === "DONE" ? "border-success bg-success text-on-primary" : "border-border",
                    !canToggle && "cursor-default",
                  )}
                  aria-label={t.status === "OPEN" ? "Mark done" : "Reopen"}
                >
                  {t.status === "DONE" && <Check className="size-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("m-0 text-[13px]", t.status !== "OPEN" && "text-text-muted line-through")}>{t.title}</p>
                  <p className="m-0 text-xs text-text-muted">
                    {t.assigneeName} · Due {formatDate(new Date(t.dueAt))}
                    {t.status === "NA" && t.naReason && ` · N/A: ${t.naReason}`}
                  </p>
                </div>
                {overdue && <Badge tone="danger">Overdue</Badge>}
                {t.status === "NA" && <Badge tone="neutral">N/A</Badge>}
                {(canMutate || t.assigneeId === currentUserId) && (
                <RowActionsMenu
                  actions={[
                    ...(t.status === "OPEN" ? [{ label: "Mark not applicable", icon: Ban, onClick: () => onNA(t) }] : []),
                    ...(t.status !== "OPEN" ? [{ label: "Reopen", icon: RotateCcw, onClick: () => onReopen(t) }] : []),
                    ...(canMutate ? [{ label: "Delete", icon: Trash2, danger: true, onClick: () => onDelete(t) }] : []),
                  ]}
                />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
