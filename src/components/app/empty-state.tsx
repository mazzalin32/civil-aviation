import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-surface-muted text-text-muted">
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <p className="m-0 max-w-[52ch] text-text-muted">{description}</p>
      {action}
    </Card>
  );
}
