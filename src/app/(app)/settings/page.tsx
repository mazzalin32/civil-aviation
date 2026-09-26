import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Settings" };

export default async function Page() {
  await requireRole("ADMIN");
  return (
    <ComingSoon
      title="Settings"
      description="Categories, lifecycles, courts, rules, security and branding."
      icon={Settings}
      emptyTitle="Settings aren't built yet"
      emptyDescription="Every list the system uses, from categories and lifecycle stages to courts and reminder rules, will be editable here."
      phase={2}
    />
  );
}
