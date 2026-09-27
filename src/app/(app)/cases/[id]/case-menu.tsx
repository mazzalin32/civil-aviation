"use client";

import { useTransition } from "react";
import { CalendarClock, Clock, FilePlus2, Pause, Play, UserCog, XCircle } from "lucide-react";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { putOnHold, resumeCase } from "./actions";

export function CaseMenu({
  matterId,
  isAdmin,
  status,
  onReassign,
}: {
  matterId: string;
  isAdmin: boolean;
  status: "OPEN" | "ON_HOLD" | "CLOSURE_REQUESTED" | "CLOSED";
  onReassign: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function onHold() {
    const reason = window.prompt("Reason for putting this case on hold (optional):") ?? "";
    startTransition(async () => {
      const result = await putOnHold({ matterId, reason });
      if (result?.error) window.alert(result.error);
    });
  }

  function onResume() {
    startTransition(async () => {
      const result = await resumeCase(matterId);
      if (result?.error) window.alert(result.error);
    });
  }

  return (
    <RowActionsMenu
      label="More actions"
      actions={[
        { label: "Schedule hearing (Phase 7)", icon: CalendarClock, disabled: true, onClick: () => {} },
        { label: "Add deadline (Phase 7)", icon: Clock, disabled: true, onClick: () => {} },
        { label: "New application (later)", icon: FilePlus2, disabled: true, onClick: () => {} },
        { kind: "separator" },
        ...(isAdmin ? [{ label: "Reassign", icon: UserCog, onClick: onReassign }] : []),
        status === "ON_HOLD"
          ? { label: "Resume case", icon: Play, disabled: pending, onClick: onResume }
          : { label: "Put on hold", icon: Pause, disabled: pending || status !== "OPEN", onClick: onHold },
        { label: "Request closure (Phase 10)", icon: XCircle, disabled: true, onClick: () => {} },
      ]}
    />
  );
}
