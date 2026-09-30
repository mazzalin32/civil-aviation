import { requireRole } from "@/lib/authz";
import { loadDashboard } from "@/lib/dashboard";
import { formatDate, greetingFor } from "@/lib/time";
import { LegalDashboard } from "@/components/app/legal-dashboard";

export const metadata = { title: "Dashboard" };

export default async function Page() {
  const user = await requireRole();
  const now = new Date();
  const data = await loadDashboard(user, now);

  return (
    <LegalDashboard
      data={{
        ...data,
        greeting: greetingFor(now, user.name),
        dateLabel: formatDate(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      }}
    />
  );
}
