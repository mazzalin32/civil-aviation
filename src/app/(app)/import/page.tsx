import { Upload } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Import" };

export default async function Page() {
  await requireRole("ADMIN");
  return (
    <ComingSoon
      title="Import"
      description="Bring existing cases and users in from Excel."
      icon={Upload}
      emptyTitle="Nothing imported"
      emptyDescription="Download the template, upload your register, check the preview and import. Each batch can be rolled back within 24 hours."
      phase={12}
    />
  );
}
