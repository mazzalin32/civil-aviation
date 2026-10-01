import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { TopBar } from "@/components/app/top-bar";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // defensive — proxy already guarantees this

  const openTaskCount = await db.task.count({ where: { assigneeId: user.id, status: "OPEN", matter: { deletedAt: null } } });

  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} openTaskCount={openTaskCount} />
      <div className="relative min-w-0 flex-1">
        <TopBar user={user} />
        <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-12 sm:px-8 sm:pt-7">{children}</main>
      </div>
    </div>
  );
}
