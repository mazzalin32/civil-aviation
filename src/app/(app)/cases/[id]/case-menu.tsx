"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, FilePlus2, Pause, Play, Trash2, UserPlus, XCircle } from "lucide-react";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { deleteCase, putOnHold, resumeCase } from "./actions";

export function CaseMenu({
  matterId,
  isAdmin,
  status,
  onReassign,
  onAddDeadline,
}: {
  matterId: string;
  isAdmin: boolean;
  status: "OPEN" | "ON_HOLD" | "CLOSURE_REQUESTED" | "CLOSED";
  onReassign: () => void;
  onAddDeadline: () => void;
}) {
  const router = useRouter();
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

  function onDelete() {
    if (!window.confirm("Delete this case? It will be removed from all lists and no longer open for anyone. Its documents and history are kept for audit.")) return;
    startTransition(async () => {
      const result = await deleteCase(matterId);
      if (result?.error) return window.alert(result.error);
      router.push("/cases");
    });
  }

  return (
    <RowActionsMenu
      label="More actions"
      actions={[
        { label: "Add deadline", icon: Clock, onClick: onAddDeadline },
        { label: "New application (later)", icon: FilePlus2, disabled: true, onClick: () => {} },
        { kind: "separator" },
        ...(isAdmin ? [{ label: "Add people / change team", icon: UserPlus, onClick: onReassign }] : []),
        status === "ON_HOLD"
          ? { label: "Resume case", icon: Play, disabled: pending, onClick: onResume }
          : { label: "Put on hold", icon: Pause, disabled: pending || status !== "OPEN", onClick: onHold },
        { label: "Request closure (Phase 10)", icon: XCircle, disabled: true, onClick: () => {} },
        ...(isAdmin ? [{ kind: "separator" as const }, { label: "Delete case", icon: Trash2, danger: true, disabled: pending, onClick: onDelete }] : []),
      ]}
    />
  );
}
