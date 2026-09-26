import { Users } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Users" };

export default async function Page() {
  await requireRole("ADMIN");
  return (
    <ComingSoon
      title="Users"
      description="Lawyer accounts, invitations and case reassignment."
      icon={Users}
      emptyTitle="No users to show"
      emptyDescription="Invite lawyers, deactivate accounts and reassign a departing lawyer's cases from here."
      phase={3}
    />
  );
}
