import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Calendar" };

export default async function Page() {
  await requireRole();
  return (
    <ComingSoon
      title="Calendar"
      description="Hearings, deadlines, mediations and tasks from your cases."
      icon={CalendarDays}
      emptyTitle="Nothing scheduled"
      emptyDescription="Dates fill in automatically from case hearings, deadlines and tasks. You never enter a date twice."
      phase={7}
    />
  );
}
