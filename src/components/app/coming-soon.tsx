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
  actions,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  phase: number;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <EmptyState icon={icon} title={emptyTitle} description={`${emptyDescription} (Built in phase ${phase}.)`} />
    </>
  );
}
