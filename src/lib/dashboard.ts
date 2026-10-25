import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { orgId } from "./org";
import type { CurrentUser } from "./session";

const ACTIVE_STATUSES = ["OPEN", "ON_HOLD", "CLOSURE_REQUESTED"] as const;
const HIGH_RISK = ["HIGH", "URGENT"] as const;

export type DashboardKpi = { label: string; value: number; hint: string; href: string; tone?: "default" | "warning" | "danger" };
export type StageBar = { name: string; count: number };
export type RiskSlice = { key: "High" | "Medium" | "Low"; count: number };
export type AttentionRow = {
  id: string;
  title: string;
  reference: string;
  stageName: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  lastActivityAt: string;
};
export type DeadlineRow = {
  id: string;
  title: string;
  matterId: string;
  matterTitle: string;
  reference: string;
  dueAt: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  overdue: boolean;
};

export type DashboardData = {
  greeting: string;
  dateLabel: string;
  isAdmin: boolean;
  kpis: DashboardKpi[];
  stages: StageBar[];
  risk: RiskSlice[];
  attention: AttentionRow[];
  deadlines: DeadlineRow[];
  overdueDeadlineCount: number;
};

/** Everyone sees their own organisation's whole portfolio on the dashboard (never another
 *  organisation's); what a lawyer may DO is gated per action. */
function matterScope(organizationId: string | null): Prisma.MatterWhereInput {
  return { deletedAt: null, organizationId: orgId(organizationId) };
}

export async function loadDashboard(user: CurrentUser, now: Date): Promise<Omit<DashboardData, "greeting" | "dateLabel">> {
  const scope = matterScope(user.organizationId);
  const activeWhere: Prisma.MatterWhereInput = { ...scope, status: { in: [...ACTIVE_STATUSES] } };
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const deadlineWhere: Prisma.CalendarEntryWhereInput = {
    kind: "DEADLINE",
    status: "OPEN",
    matter: activeWhere,
  };

  const [
    activeCount,
    awaitingTasks,
    awaitingDeadlines,
    upcomingDeadlines,
    highRiskCount,
    highRiskThisMonth,
    activeMatters,
    deadlineRows,
  ] = await Promise.all([
    db.matter.count({ where: { ...scope, status: "OPEN" } }),
    db.task.count({
      where: { status: "OPEN", dueAt: { lt: now }, matter: activeWhere },
    }),
    db.calendarEntry.count({ where: { ...deadlineWhere, startsAt: { lt: now } } }),
    db.calendarEntry.count({ where: { ...deadlineWhere, startsAt: { gte: now, lte: in30 } } }),
    db.matter.count({ where: { ...activeWhere, priority: { in: [...HIGH_RISK] } } }),
    db.matter.count({ where: { ...activeWhere, priority: { in: [...HIGH_RISK] }, createdAt: { gte: monthStart } } }),
    db.matter.findMany({
      where: activeWhere,
      select: {
        id: true,
        title: true,
        reference: true,
        priority: true,
        lastActivityAt: true,
        currentStage: { select: { name: true } },
      },
      orderBy: { lastActivityAt: "desc" },
    }),
    db.calendarEntry.findMany({
      where: deadlineWhere,
      orderBy: { startsAt: "asc" },
      take: 8,
      select: {
        id: true,
        title: true,
        startsAt: true,
        matterId: true,
        matter: { select: { title: true, reference: true, priority: true } },
      },
    }),
  ]);

  const awaiting = awaitingTasks + awaitingDeadlines;
  const stageMap = new Map<string, number>();
  const risk = { High: 0, Medium: 0, Low: 0 };
  for (const m of activeMatters) {
    const name = m.currentStage?.name ?? "Unstaged";
    stageMap.set(name, (stageMap.get(name) ?? 0) + 1);
    if (m.priority === "HIGH" || m.priority === "URGENT") risk.High += 1;
    else if (m.priority === "MEDIUM") risk.Medium += 1;
    else risk.Low += 1;
  }

  const stageTemplates = await db.stageTemplate.findMany({
    where: { isActive: true, matterType: { isSubProcess: false, isActive: true } },
    select: { name: true, order: true },
    orderBy: { order: "asc" },
  });
  const orderByName = new Map<string, number>();
  for (const s of stageTemplates) {
    if (!orderByName.has(s.name)) orderByName.set(s.name, s.order);
  }
  const stages: StageBar[] = [...stageMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (orderByName.get(a.name) ?? 99) - (orderByName.get(b.name) ?? 99) || b.count - a.count);

  const highRiskIds = new Set(activeMatters.filter((m) => m.priority === "HIGH" || m.priority === "URGENT").map((m) => m.id));
  const overdueMatterIds = new Set(deadlineRows.filter((d) => d.startsAt < now && d.matterId).map((d) => d.matterId as string));
  const attention: AttentionRow[] = [];
  const seen = new Set<string>();
  for (const m of activeMatters) {
    if (highRiskIds.has(m.id) || overdueMatterIds.has(m.id)) {
      seen.add(m.id);
      attention.push({
        id: m.id,
        title: m.title,
        reference: m.reference,
        stageName: m.currentStage?.name ?? null,
        priority: m.priority,
        lastActivityAt: m.lastActivityAt.toISOString(),
      });
    }
    if (attention.length >= 6) break;
  }
  if (attention.length < 6) {
    for (const m of activeMatters) {
      if (seen.has(m.id)) continue;
      attention.push({
        id: m.id,
        title: m.title,
        reference: m.reference,
        stageName: m.currentStage?.name ?? null,
        priority: m.priority,
        lastActivityAt: m.lastActivityAt.toISOString(),
      });
      if (attention.length >= 6) break;
    }
  }

  const kpis: DashboardKpi[] = [
    { label: "Active Legal Matters", value: activeCount, hint: "Currently Active", href: "/cases?status=OPEN" },
    {
      label: "Matters Requiring Action",
      value: awaiting,
      hint: awaiting > 0 ? "Requires Legal Attention" : "Nothing overdue",
      href: "/tasks",
      tone: awaiting > 0 ? "warning" : "default",
    },
    { label: "Upcoming Legal Deadlines", value: upcomingDeadlines, hint: "Due Within 30 Days", href: "/calendar" },
    {
      label: "High-Risk Legal Matters",
      value: highRiskCount,
      hint: highRiskThisMonth > 0 ? `${highRiskThisMonth} new this month` : "High or Urgent Legal Priority",
      href: "/cases?highRisk=1",
      tone: highRiskCount > 0 ? "danger" : "default",
    },
  ];

  return {
    isAdmin: user.role === "ADMIN",
    kpis,
    stages,
    risk: [
      { key: "High", count: risk.High },
      { key: "Medium", count: risk.Medium },
      { key: "Low", count: risk.Low },
    ],
    attention,
    deadlines: deadlineRows
      .filter((d) => d.matter && d.matterId)
      .map((d) => ({
        id: d.id,
        title: d.title,
        matterId: d.matterId as string,
        matterTitle: d.matter!.title,
        reference: d.matter!.reference,
        dueAt: d.startsAt.toISOString(),
        priority: d.matter!.priority,
        overdue: d.startsAt < now,
      })),
    overdueDeadlineCount: awaitingDeadlines,
  };
}
