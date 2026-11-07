import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { CHAT_UNREAD_EMAIL_RULE } from "@/lib/notify";
import { formatDate } from "@/lib/time";
import { DigestSetting, NotificationPreferences, type PreferenceRow } from "./notification-preferences";

export const metadata = { title: "Profile & preferences" };

/** Admin-only notification types — a lawyer is never sent these, so they aren't listed for them. */
const ADMIN_ONLY = new Set(["SUSPICIOUS_ACTIVITY"]);

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[13.5px] last:border-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 text-right font-medium">{value ?? <span className="font-normal text-text-muted">—</span>}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireRole();
  const [me, rules, prefs] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { phone: true, department: true, practisingCertNo: true, certExpiry: true, digestEnabled: true, passwordChangedAt: true, mfaEnabledAt: true, lastLoginAt: true },
    }),
    db.notificationRule.findMany({ orderBy: { label: "asc" } }),
    db.notificationPreference.findMany({ where: { userId: user.id } }),
  ]);

  const hasNotifications = user.role !== "SUPERADMIN";
  const pref = new Map(prefs.map((p) => [p.type, p]));
  const chatRule = rules.find((r) => r.trigger === CHAT_UNREAD_EMAIL_RULE);
  const rows: PreferenceRow[] = rules
    // The chat-email rule is a delay setting, not something you're notified about.
    .filter((r) => r.trigger !== CHAT_UNREAD_EMAIL_RULE && (user.role === "ADMIN" || !ADMIN_ONLY.has(r.trigger)))
    .map((r) => ({
      type: r.trigger,
      label: r.label,
      mutable: r.mutable,
      sendsInApp: r.channels.includes("IN_APP"),
      sendsEmail: r.channels.includes("EMAIL"),
      inApp: pref.get(r.trigger)?.inApp ?? true,
      email: pref.get(r.trigger)?.email ?? true,
    }));

  return (
    <>
      <PageHeader title="Profile & preferences" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3 pb-3">
                <Avatar name={user.name} seed={user.id} className="size-11 text-sm" />
                <div className="min-w-0">
                  <p className="m-0 truncate text-base font-semibold">{user.name}</p>
                  <p className="m-0 truncate text-[13px] text-text-muted">{user.email}</p>
                </div>
              </div>
              <dl className="m-0">
                <Fact label="Role" value={user.role === "ADMIN" ? "Admin" : user.role === "LAWYER" ? "Lawyer" : "Superadmin"} />
                <Fact label="Title" value={user.title} />
                <Fact label="Department" value={me.department} />
                <Fact label="Phone" value={me.phone} />
                {user.role !== "SUPERADMIN" && <Fact label="Practising certificate" value={me.practisingCertNo} />}
                {user.role !== "SUPERADMIN" && <Fact label="Certificate expires" value={me.certExpiry ? formatDate(me.certExpiry) : null} />}
              </dl>
              <p className="m-0 mt-3 text-xs text-text-muted">To change these details, ask the Head of Legal.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <KeyRound className="size-4 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium">Password</p>
                  <p className="m-0 text-xs text-text-muted">{me.passwordChangedAt ? `Last changed ${formatDate(me.passwordChangedAt)}` : "Never changed"}</p>
                </div>
                <Link href="/change-password" className={buttonVariants({ size: "sm" })}>
                  Change
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-4 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium">Two-step sign-in</p>
                  <p className="m-0 text-xs text-text-muted">A code is emailed to you each time you sign in.</p>
                </div>
                {user.twoFactorEnabled ? <Badge tone="success">On</Badge> : <Badge tone="warning">Off</Badge>}
              </div>
              {me.lastLoginAt && <p className="m-0 text-xs text-text-muted">Last sign-in {formatDate(me.lastLoginAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
            </CardContent>
          </Card>
        </div>

        {hasNotifications && (
          <div className="flex flex-col gap-5">
            <DigestSetting enabled={me.digestEnabled} />
            <NotificationPreferences rows={rows} chatEmailDelay={chatRule?.channels.includes("EMAIL") ? (chatRule.offsets[0] ?? null) : null} />
          </div>
        )}
      </div>
    </>
  );
}
