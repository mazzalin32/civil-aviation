import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { LawFirmsView } from "./law-firms-view";

export const metadata = { title: "Law Firms & Counsel" };

export default async function LawFirmsPage() {
  const user = await requireRole();

  const firms = await db.lawFirm.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader title="Law Firms & Counsel" description="External firm(s) and Counsel(s)" />
      <LawFirmsView isAdmin={user.role === "ADMIN"} firms={firms} />
    </>
  );
}
