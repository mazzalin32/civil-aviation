import { FilePlus2 } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "New case" };

export default async function Page() {
  await requireRole("ADMIN");
  return (
    <ComingSoon
      title="New case"
      description="Open a matter and assign the legal team."
      icon={FilePlus2}
      emptyTitle="The new-case wizard isn't built yet"
      emptyDescription="A 5-step wizard will cover basics, forum, parties, facts and value, and assignment."
      phase={4}
    />
  );
}
