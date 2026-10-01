"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Landmark, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { scheduleEntry } from "@/app/(app)/calendar/actions";
import { withToast } from "@/components/ui/toast";

export function ScheduleEntryDialog({
  matterId,
  kind,
  forums,
  team,
  open,
  onClose,
}: {
  matterId: string;
  kind: "HEARING" | "DEADLINE";
  forums: { id: string; name: string }[];
  team: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      // Only HEARING renders forumId/courtroom, only DEADLINE renders isCritical — an
      // unrendered field's formData.get() is null, which fails the (string) zod schema.
      const result = await withToast(scheduleEntry({
        matterId,
        kind,
        title: formData.get("title"),
        startsAt: formData.get("startsAt"),
        forumId: formData.get("forumId") ?? "",
        courtroom: formData.get("courtroom") ?? "",
        purpose: formData.get("purpose") ?? "",
        isCritical: formData.get("isCritical") === "on",
        assigneeId: formData.get("assigneeId") ?? "",
      }), "Added to the calendar");
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title={kind === "HEARING" ? "Schedule hearing" : "Add deadline"}>
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <Field label="Title" htmlFor="se-title">
          <Input id="se-title" name="title" required autoFocus placeholder={kind === "HEARING" ? "e.g. Scheduling conference" : "e.g. File submissions"} />
        </Field>
        <Field label={kind === "HEARING" ? "Date & time" : "Due date"} htmlFor="se-date">
          <Input id="se-date" name="startsAt" type={kind === "HEARING" ? "datetime-local" : "date"} icon={CalendarClock} required />
        </Field>
        {kind === "HEARING" && (
          <>
            <Field label="Court" htmlFor="se-forum">
              <Select id="se-forum" name="forumId" icon={Landmark}>
                <option value="">Not set</option>
                {forums.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Courtroom" htmlFor="se-courtroom">
              <Input id="se-courtroom" name="courtroom" />
            </Field>
          </>
        )}
        <Field label="Purpose" htmlFor="se-purpose" hint="Optional">
          <Input id="se-purpose" name="purpose" placeholder="e.g. Hearing of injunction application" />
        </Field>
        <Field label="Assignee" htmlFor="se-assignee" hint="Optional">
          <Select id="se-assignee" name="assigneeId" icon={User}>
            <option value="">Whole team</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        {kind === "DEADLINE" && (
          <label className="flex items-center gap-2 text-[13px] text-text-muted">
            <input type="checkbox" name="isCritical" className="size-4 accent-primary" />
            Critical (can&apos;t be muted, shows red when ≤24h or overdue)
          </label>
        )}
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
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
