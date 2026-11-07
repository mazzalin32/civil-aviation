import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { TopBar } from "@/components/app/top-bar";
import { getCurrentUser } from "@/lib/session";
import { assertOnboarded } from "@/lib/authz";
import { db } from "@/lib/db";
import { getTotalUnread } from "@/lib/chat/unread";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // signed out, expired session, or deactivated/deleted account
  assertOnboarded(user); // forced password change, then mandatory 2FA

  const [openTaskCount, unreadNotifications, unreadChatCount] = await Promise.all([
    db.task.count({ where: { assigneeId: user.id, status: "OPEN", matter: { deletedAt: null } } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    getTotalUnread(user),
  ]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} openTaskCount={openTaskCount} unreadChatCount={unreadChatCount} />
      <div className="relative min-w-0 flex-1">
        <TopBar user={user} unreadNotifications={unreadNotifications} />
        <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-12 sm:px-8 sm:pt-7">{children}</main>
      </div>
    </div>
  );
}
