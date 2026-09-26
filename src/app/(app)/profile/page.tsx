import { UserRound } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireRole } from "@/lib/authz";

export const metadata = { title: "Profile & preferences" };

export default async function Page() {
  await requireRole();
  return (
    <ComingSoon
      title="Profile & preferences"
      description="Your details, security, theme and notification settings."
      icon={UserRound}
      emptyTitle="Preferences aren't built yet"
      emptyDescription="Change your password, manage 2FA, pick light or dark theme and choose which notifications you get."
      phase={1}
    />
  );
}
