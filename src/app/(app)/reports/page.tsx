import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Reports" };

export default async function Page() {
  await requireRole();
  return (
    <ComingSoon
      title="Reports"
      description="Case register, outcomes, workload, exposure and durations."
      icon={BarChart3}
      emptyTitle="No reports yet"
      emptyDescription="Reports with filters, drill-down and Excel, CSV or PDF export will live here."
      phase={11}
    />
  );
}
