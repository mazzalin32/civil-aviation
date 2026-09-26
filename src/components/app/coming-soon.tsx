import type { LucideIcon } from "lucide-react";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/** Phase 0 placeholder: a real page frame with an honest empty state. */
export function ComingSoon({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  phase,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  phase: number;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} title={emptyTitle} description={`${emptyDescription} (Built in phase ${phase}.)`} />
    </>
  );
}
