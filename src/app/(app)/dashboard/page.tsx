import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { loadDashboard } from "@/lib/dashboard";
import { formatDate, greetingFor } from "@/lib/time";
import { LegalDashboard } from "@/components/app/legal-dashboard";
import { WelcomeCard } from "@/components/app/welcome-card";

export const metadata = { title: "Dashboard" };

export default async function Page() {
  const user = await requireRole();
  const now = new Date();
  const [data, prefs] = await Promise.all([
    loadDashboard(user, now),
    db.user.findUnique({ where: { id: user.id }, select: { welcomeDismissedAt: true, digestEnabled: true } }),
  ]);
  const showWelcome = (user.role === "ADMIN" || user.role === "LAWYER") && prefs !== null && prefs.welcomeDismissedAt === null;

  return (
    <LegalDashboard
      data={{
        ...data,
        greeting: greetingFor(now, user.name),
        dateLabel: formatDate(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      }}
      welcome={showWelcome ? <WelcomeCard name={user.name} role={user.role as "ADMIN" | "LAWYER"} digestEnabled={prefs.digestEnabled} /> : null}
    />
  );
}
