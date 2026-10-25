import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { NewOrganizationForm } from "./form";

export const metadata = { title: "New organisation" };

export default async function NewOrganizationPage() {
  await requireRole("SUPERADMIN");

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New organisation" />
      <NewOrganizationForm />
    </div>
  );
}
