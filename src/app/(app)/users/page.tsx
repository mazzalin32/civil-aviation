import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/session";
import { AddLawyer } from "./add-lawyer";
import { UserRowItem } from "./user-row";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  await requireRole("ADMIN");
  const me = await getCurrentUser();

  const users = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { accounts: { where: { providerId: "credential" }, select: { id: true } } },
  });

  return (
    <>
      <PageHeader title="Users" description="Lawyer accounts: invite, edit, deactivate, and manage sessions." />
      <Card>
        <AddLawyer />
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
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
