import Link from "next/link";
import { Upload } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { orgId } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/session";
import { AddLawyer } from "./add-lawyer";
import { UserRowItem } from "./user-row";
import { UserFiltersBar } from "./user-filters";
import { ExportButtons } from "./export-buttons";
import { buildUserWhere, parseUserFilters } from "./filters";

export const metadata = { title: "Users" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const me = await getCurrentUser();
  const sp = await searchParams;
  const filters = parseUserFilters(sp);
  const openAdd = sp.new === "1";

  const [users, departmentRows] = await Promise.all([
    db.user.findMany({
      where: buildUserWhere(filters, me?.organizationId ?? null),
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { accounts: { where: { providerId: "credential" }, select: { id: true } } },
    }),
    db.user.findMany({ where: { department: { not: null }, organizationId: orgId(me?.organizationId ?? null) }, select: { department: true }, distinct: ["department"] }),
  ]);
  const departments = departmentRows.map((d) => d.department!).sort();

  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.department) query.set("department", filters.department);
  if (filters.certExpiring) query.set("certExpiring", filters.certExpiring);
  const queryString = query.size ? `&${query.toString()}` : "";

  return (
    <>
      <PageHeader
        title="Users"
        actions={
          <>
            <ExportButtons query={queryString} />
            <Link href="/users/import" className={buttonVariants({ variant: "secondary" })}>
              <Upload className="size-4" /> Import
            </Link>
            <AddLawyer autoOpen={openAdd} />
          </>
        }
      />
      <Card>
        <UserFiltersBar filters={filters} departments={departments} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Name</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Title</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Practising cert.</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Status</th>
                <th className="border-b border-border px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRowItem
                  key={u.id}
                  user={{
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    phone: u.phone,
                    title: u.title,
                    department: u.department,
                    practisingCertNo: u.practisingCertNo,
                    certExpiry: u.certExpiry ? u.certExpiry.toISOString() : null,
                    isActive: u.isActive,
                    hasAccount: u.accounts.length > 0,
                    isSelf: u.id === me?.id,
                  }}
                />
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
