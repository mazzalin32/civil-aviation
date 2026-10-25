import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { formatDate } from "@/lib/time";

export const metadata = { title: "Organisations" };

export default async function SuperadminPage() {
  await requireRole("SUPERADMIN");

  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true, matters: true, contracts: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Organisations"
        description="Every organisation on the platform — create one, brand it, and invite its first Admin."
        actions={
          <Link href="/superadmin/new" className={buttonVariants({ variant: "primary" })}>
            <Plus className="size-4" /> New organisation
          </Link>
        }
      />

      {organizations.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-card border border-dashed border-border bg-surface-muted p-12 text-center">
          <Building2 className="size-8 text-text-muted" strokeWidth={1.5} />
          <p className="m-0 text-[13.5px] text-text-muted">No organisations yet.</p>
          <Link href="/superadmin/new" className={buttonVariants({ variant: "primary" })}>
            <Plus className="size-4" /> New organisation
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {organizations.map((org) => (
            <Link
              key={org.id}
              href={`/superadmin/${org.id}`}
              className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary"
            >
              <div aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control border border-border bg-surface-muted">
                {org.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logoUrl} alt="" width={32} height={32} style={{ display: "block", maxWidth: "100%", maxHeight: "100%" }} />
                ) : (
                  <Building2 className="size-5 text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="truncate text-[14px]">{org.name}</b>
                  {!org.isActive && <Badge tone="neutral">Inactive</Badge>}
                </div>
                <p className="m-0 text-[12.5px] text-text-muted">
                  {org._count.users} user{org._count.users === 1 ? "" : "s"} · {org._count.matters} matter{org._count.matters === 1 ? "" : "s"} · {org._count.contracts} contract
                  {org._count.contracts === 1 ? "" : "s"} · created {formatDate(org.createdAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
