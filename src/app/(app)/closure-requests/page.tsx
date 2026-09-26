import { FileCheck2 } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Closure requests" };

export default async function Page() {
  await requireRole("ADMIN");
  return (
    <ComingSoon
      title="Closure requests"
      description="Review lawyers' requests to close cases."
      icon={FileCheck2}
      emptyTitle="No closure requests"
      emptyDescription="When a lawyer asks to close a case, the request appears here for you to approve or return."
      phase={10}
    />
  );
}
