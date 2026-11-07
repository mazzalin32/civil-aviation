import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { ReminderRow } from "./reminder-row";

export const metadata = { title: "Reminder schedules" };

export default async function RemindersPage() {
  await requireRole("ADMIN");
  const rules = await db.notificationRule.findMany({ orderBy: { label: "asc" } });

  return (
    <>
      <PageHeader title="Reminder schedules" />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Trigger</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Schedule</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Channels</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Lawyer control</th>
                <th className="border-b border-border px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <ReminderRow key={r.id} rule={{ id: r.id, label: r.label, offsets: r.offsets, offsetUnit: r.offsetUnit, channels: r.channels, mutable: r.mutable }} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
