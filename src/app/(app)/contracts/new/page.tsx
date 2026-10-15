import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { getContractIntakeOptions } from "./actions";
import { NewContractForm } from "./form";

export const metadata = { title: "New contract" };

export default async function NewContractPage() {
  await requireRole("ADMIN");
  const { categories, lawyers } = await getContractIntakeOptions();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New contract" description="Register a contract so Legal can track it through review, approval and signature." />
      <NewContractForm categories={categories} lawyers={lawyers} />
    </div>
  );
}
