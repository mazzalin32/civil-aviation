import Link from "next/link";
import { Clock } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tasks" };

const PRIORITY_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" } as const;

export default async function Page() {
  const user = await requireRole();
  const isAdmin = user.role === "ADMIN";
  const now = new Date();

  const tasks = await db.task.findMany({
    where: {
      status: "OPEN",
      ...(isAdmin ? {} : { assigneeId: user.id }),
      matter: isAdmin ? undefined : { assignments: { some: { userId: user.id, removedAt: null } } },
    },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      title: true,
      dueAt: true,
      assignee: { select: { name: true } },
      matter: { select: { id: true, title: true, reference: true, priority: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Tasks"
        description={isAdmin ? "Open tasks across the department." : "Open tasks assigned to you."}
      />
      {tasks.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No open tasks"
          description={isAdmin ? "When lawyers have work due on a case, it will list here." : "Tasks from your cases will list here with due dates."}
        />
      ) : (
        <Card>
          <ul className="m-0 grid list-none divide-y divide-border p-0">
            {tasks.map((t) => {
              const overdue = t.dueAt < now;
              return (
                <li key={t.id}>
                  <Link href={`/cases/${t.matter.id}?tab=tasks`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-muted">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", overdue ? "bg-danger-soft text-danger" : "bg-surface-muted text-text-muted")}>
                      <Clock className="size-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{t.title}</span>
                      <span className="block truncate text-[12px] text-text-muted">
                        {t.matter.reference} · {t.matter.title}
                        {isAdmin ? ` · ${t.assignee.name}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn("block text-[12px] font-medium", overdue ? "text-danger" : "text-text")}>
                        {overdue ? "Overdue" : formatDate(t.dueAt)}
                      </span>
                      <Badge tone={PRIORITY_TONE[t.matter.priority]} className="mt-1">
                        {t.matter.priority[0] + t.matter.priority.slice(1).toLowerCase()}
                      </Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
