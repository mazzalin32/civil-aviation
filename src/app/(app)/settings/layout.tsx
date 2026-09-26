import { requireRole } from "@/lib/authz";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");

  return (
    <div>
      <SettingsTabs />
      <div className="pt-5">{children}</div>
    </div>
  );
}
