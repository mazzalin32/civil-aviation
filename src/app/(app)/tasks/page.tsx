import { SquareCheckBig } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Tasks" };

export default async function Page() {
  await requireRole("LAWYER");
  return (
    <ComingSoon
      title="Tasks"
      description="Everything assigned to you across your cases."
      icon={SquareCheckBig}
      emptyTitle="No tasks yet"
      emptyDescription="Tasks from your cases, such as drafting a witness statement or serving summons, will be listed here with due dates."
      phase={7}
    />
  );
}
