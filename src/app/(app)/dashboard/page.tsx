import { LayoutGrid } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Dashboard" };

export default async function Page() {
  await requireRole("ADMIN");
  return (
    <ComingSoon
      title="Dashboard"
      description="The whole department at a glance."
      icon={LayoutGrid}
      emptyTitle="No cases yet"
      emptyDescription="Open cases, hearings this week, overdue deadlines, lawyer workload and cases going cold will appear here."
      phase={11}
    />
  );
}
