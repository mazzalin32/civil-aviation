import { requireRole } from "@/lib/authz";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");

  return (
    <div>
      <div className="mb-6">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.01em]">Settings</h1>
        <p className="mt-1 mb-0 text-[13px] text-text-muted">
          Everything here ships with sensible defaults. Changing a setting never breaks existing cases — deactivated
          items stay on old cases; edits apply to new ones.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <SettingsTabs />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
