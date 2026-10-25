import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { OrgPanel } from "./org-panel";

export const metadata = { title: "Organisation" };

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPERADMIN");
  const { id } = await params;

  const org = await db.organization.findUnique({
    where: { id },
    include: {
      users: { where: { role: "ADMIN", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true } },
    },
  });
  if (!org) notFound();

  return (
    <div>
      <Link href="/superadmin" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-primary">
        <ArrowLeft className="size-3.5" /> Organisations
      </Link>

      <div className="mb-6">
        <h1 className="m-0 font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">{org.name}</h1>
        <p className="mt-1 mb-0 text-[13px] text-text-muted">Created {org.createdAt.toLocaleDateString()}</p>
      </div>

      <OrgPanel
        organizationId={org.id}
        name={org.name}
        logoUrl={org.logoUrl}
        primaryColor={org.primaryColor}
        admins={org.users.map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
