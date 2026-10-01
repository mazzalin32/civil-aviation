"use client";

import { useMemo, useState, useTransition } from "react";
import { GitCommitHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { moveStage } from "./actions";
import { withToast } from "@/components/ui/toast";

export type StageOption = { id: string; name: string; order: number; requiredFields: string[] };

export function MoveStageDialog({
  matterId,
  stages,
  currentStageId,
  open,
  onClose,
}: {
  matterId: string;
  stages: StageOption[];
  currentStageId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const currentStage = stages.find((s) => s.id === currentStageId);
  const defaultTarget = useMemo(() => {
    if (!currentStage) return stages[0]?.id ?? "";
    const next = stages.find((s) => s.order === currentStage.order + 1);
    return next?.id ?? currentStage.id;
  }, [stages, currentStage]);

  const [targetId, setTargetId] = useState(defaultTarget);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const target = stages.find((s) => s.id === targetId);
  const goingBack = currentStage && target && target.order < currentStage.order;

  function create(formData: FormData) {
    setError(undefined);
    const fields: Record<string, string> = {};
    for (const key of target?.requiredFields ?? []) fields[key] = String(formData.get(`field-${key}`) ?? "");
    startTransition(async () => {
      const result = await withToast(moveStage({ matterId, stageTemplateId: targetId, note: formData.get("note"), fields }), "Stage updated");
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Move stage">
      <form action={create} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <Field label="Move to" htmlFor="ms-stage">
          <Select id="ms-stage" icon={GitCommitHorizontal} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.id === currentStageId ? " (current)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        {target?.requiredFields.map((key) => (
          <Field key={key} label={key} htmlFor={`field-${key}`}>
            <Input id={`field-${key}`} name={`field-${key}`} required />
          </Field>
        ))}

        <Field label="Note" htmlFor="ms-note" hint={goingBack ? "Required — explain why this case is moving back a stage." : "Optional"}>
          <textarea
            id="ms-note"
            name="note"
            rows={3}
            required={Boolean(goingBack)}
            className="w-full rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          />
        </Field>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending || targetId === currentStageId}>
            {pending ? "Moving…" : "Move stage"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}
