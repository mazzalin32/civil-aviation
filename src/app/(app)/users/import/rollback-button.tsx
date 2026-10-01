"use client";

import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rollbackImportBatch } from "./actions";
import { toast, withToast } from "@/components/ui/toast";

export function RollbackButton({ batchId, createdCount }: { batchId: string; createdCount: number }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Roll back this import? The ${createdCount} account(s) it created will be deactivated.`)) return;
    startTransition(async () => {
      const result = await withToast(rollbackImportBatch(batchId), "Import rolled back");
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button size="sm" disabled={pending} onClick={onClick}>
      <Undo2 className="size-4" /> {pending ? "Rolling back…" : "Roll back"}
    </Button>
  );
}
