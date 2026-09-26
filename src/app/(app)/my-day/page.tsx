import { Sun } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "My Day" };

export default async function Page() {
  await requireRole("LAWYER");
  return (
    <ComingSoon
      title="My Day"
      description="Your hearings, deadlines and tasks for today and this week."
      icon={Sun}
      emptyTitle="Your cases will appear here"
      emptyDescription="Once the Head of Legal assigns you a case, today's hearings, deadlines and tasks show up here, with anything overdue pinned to the top."
      phase={11}
    />
  );
}
