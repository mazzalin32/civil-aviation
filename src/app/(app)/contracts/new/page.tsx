import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { getContractIntakeOptions } from "./actions";
import { NewContractForm } from "./form";

export const metadata = { title: "New contract" };

export default async function NewContractPage() {
  await requireRole("ADMIN");
  const { categories, lawyers } = await getContractIntakeOptions();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New contract" />
      <NewContractForm categories={categories} lawyers={lawyers} />
    </div>
  );
}
