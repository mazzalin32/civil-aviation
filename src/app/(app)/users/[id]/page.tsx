import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { getCurrentUser } from "@/lib/session";
import { accountStatus } from "@/lib/invite-status";
import { inviteInfo } from "@/lib/password-links";
import { Card } from "@/components/ui/card";
import { UserDetailCard } from "./user-detail-card";
import { ActivityList } from "./activity-list";

export const metadata = { title: "User details" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole("ADMIN");
  const me = await getCurrentUser();
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: { accounts: { where: { providerId: "credential" }, select: { id: true } } },
  });
  // Users & Access manages this organisation's Admin/Lawyer accounts only — Superadmin
  // accounts belong to no organisation and are managed from /superadmin instead, and another
  // organisation's user must 404 rather than be confirmed to exist.
  if (!user || user.role === "SUPERADMIN" || user.organizationId !== admin.organizationId) notFound();

  const hasPassword = user.accounts.length > 0;
  const invite = hasPassword ? { link: null, lastSentAt: null } : (await inviteInfo([user.id]))(user.id);
  const status = accountStatus({ isActive: user.isActive, hasPassword, ...invite, now: new Date() });

  const activity = await db.auditLog.findMany({
    where: { entity: "User", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { user: { select: { name: true } } },
  });

  return (
    <>
      <Link href="/users" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text">
        <ArrowLeft className="size-3.5" /> Users
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <UserDetailCard
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              title: user.title,
              department: user.department,
              practisingCertNo: user.practisingCertNo,
              certExpiry: user.certExpiry ? user.certExpiry.toISOString() : null,
              role: user.role,
              isActive: user.isActive,
              status,
              twoFactorEnabled: user.twoFactorEnabled,
              lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
              createdAt: user.createdAt.toISOString(),
              isSelf: user.id === me?.id,
            }}
          />
        </Card>
        <Card className="p-5">
          <h2 className="m-0 mb-3 text-sm font-semibold">Recent activity</h2>
          <ActivityList
            entries={activity.map((a) => ({
              id: a.id,
              action: a.action,
              by: a.user?.name ?? "System",
              at: a.createdAt.toISOString(),
            }))}
          />
        </Card>
      </div>
    </>
  );
}
