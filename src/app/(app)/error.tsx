"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="This page didn't load"
      description={`Something went wrong on our side. Try again, and if it keeps happening, give the Head of Legal this reference: ${error.digest ?? "no reference"}.`}
      action={
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
