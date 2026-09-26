import { DevRoleSwitch } from "@/components/app/dev-role-switch";
import { Sidebar } from "@/components/app/sidebar";
import { TopBar } from "@/components/app/top-bar";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} devSwitch={<DevRoleSwitch role={user.role} />} />
      <div className="relative min-w-0 flex-1">
        <TopBar user={user} />
        <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-12 sm:px-8 sm:pt-7">{children}</main>
      </div>
    </div>
  );
}
