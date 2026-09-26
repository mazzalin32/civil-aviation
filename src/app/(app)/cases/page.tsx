import { BriefcaseBusiness } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Cases" };

export default async function Page() {
  const user = await requireRole();
  const admin = user.role === "ADMIN";
  return (
    <ComingSoon
      title={admin ? "Cases" : "My cases"}
      description={admin ? "Every matter in the department." : "Matters you lead or support."}
      icon={BriefcaseBusiness}
      emptyTitle="No cases yet"
      emptyDescription={
        admin
          ? "Cases appear here once they are created or imported, with filters for status, stage, court, lawyer and time range."
          : "Cases the Head of Legal assigns to you will appear here, with their stage and next date."
      }
      phase={4}
    />
  );
}
