import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { orgId } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { CaseFiltersBar, type CaseFilterOptions } from "../cases/case-filters";
import { buildCaseOrderBy, buildCaseWhere, parseCaseFilters, PRIORITY_RANK, type SortKey } from "../cases/filters";
import { ReportTabs, type ReportTab } from "./report-tabs";
import { ReportExportButtons } from "./export-buttons";
import { CaseRegisterView, type RegisterRow } from "./case-register-view";
import { OutcomesView, type OutcomeRow } from "./outcomes-view";
import { WorkloadView, type WorkloadMatterRow } from "./workload-view";
import { DistributionView, type DistributionRow } from "./distribution-view";
import { DurationsView, type DurationMatterRow, type DurationStageRow } from "./durations-view";
import { FinancialView, type FinancialRow } from "./financial-view";
import { HearingsView, type HearingRow } from "./hearings-view";
import { DeadlinesView, type DeadlineRow } from "./deadlines-view";
import { InactiveView, type InactiveRow } from "./inactive-view";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole("ADMIN");
  const sp = await searchParams;
  const filters = parseCaseFilters(sp);
  const tab = (typeof sp.tab === "string" ? sp.tab : "register") as ReportTab;
  const where = buildCaseWhere(filters, user.organizationId);
  const inactiveDays = Number(sp.inactiveDays) > 0 ? Number(sp.inactiveDays) : 30;

  const [matters, categories, matterTypes, forums, lawyers, stageRows] = await Promise.all([
    db.matter.findMany({
      where,
      orderBy: buildCaseOrderBy(filters),
      select: {
        id: true,
        reference: true,
        title: true,
        priority: true,
        status: true,
        ucaaRole: true,
        amountClaimed: true,
        amountAgainst: true,
        createdAt: true,
        lastActivityAt: true,
        closedAt: true,
        categoryId: true,
        category: { select: { name: true } },
        matterType: { select: { name: true } },
        currentStage: { select: { name: true } },
        outcome: { select: { name: true } },
        closedBy: { select: { name: true } },
        forumId: true,
        forum: { select: { name: true } },
        assignments: { where: { removedAt: null }, select: { role: true, user: { select: { id: true, name: true } } } },
        stageMoves: { select: { enteredAt: true, exitedAt: true, stageTemplate: { select: { name: true } } } },
      },
    }),
    db.category.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.matterType.findMany({ where: { isActive: true, isSubProcess: false }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.forum.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "LAWYER", isActive: true, organizationId: orgId(user.organizationId) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.stageTemplate.findMany({ where: { isActive: true }, select: { name: true }, distinct: ["name"], orderBy: { name: "asc" } }),
  ]);

  const matterIds = matters.map((m) => m.id);
  const now = new Date();

  const [upcomingHearings, overdueEntries, overdueTasks] = await Promise.all([
    tab === "hearings"
      ? db.calendarEntry.findMany({
          where: { matterId: { in: matterIds }, kind: "HEARING", status: "OPEN", startsAt: { gte: now } },
          orderBy: { startsAt: "asc" },
          select: {
            id: true,
            title: true,
            startsAt: true,
            courtroom: true,
            forum: { select: { name: true } },
            assignee: { select: { name: true } },
            matter: { select: { id: true, reference: true, title: true } },
          },
        })
      : [],
    tab === "deadlines"
      ? db.calendarEntry.findMany({
          where: { matterId: { in: matterIds }, kind: "DEADLINE", status: "OPEN", startsAt: { lt: now } },
          select: {
            id: true,
            title: true,
            startsAt: true,
            assignee: { select: { name: true } },
            matter: { select: { id: true, reference: true, title: true } },
          },
        })
      : [],
    tab === "deadlines"
      ? db.task.findMany({
          where: { matterId: { in: matterIds }, status: "OPEN", doneAt: null, dueAt: { lt: now } },
          select: {
            id: true,
            title: true,
            dueAt: true,
            assignee: { select: { name: true } },
            matter: { select: { id: true, reference: true, title: true } },
          },
        })
      : [],
  ]);

  const registerRows: RegisterRow[] = matters.map((m) => ({
    id: m.id,
    reference: m.reference,
    title: m.title,
    categoryName: m.category.name,
    matterTypeName: m.matterType.name,
    stageName: m.currentStage?.name ?? null,
    status: m.status,
    priority: m.priority,
    amountClaimed: m.amountClaimed !== null ? m.amountClaimed.toString() : null,
    leadName: m.assignments.find((a) => a.role === "LEAD")?.user.name ?? null,
    createdAt: m.createdAt,
    lastActivityAt: m.lastActivityAt,
  }));
  if (filters.sort === "priority") {
    registerRows.sort((a, b) => (filters.dir === "asc" ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]));
  }

  const outcomeRows: OutcomeRow[] = matters.map((m) => ({
    id: m.id,
    reference: m.reference,
    title: m.title,
    outcomeName: m.outcome?.name ?? null,
    closedAt: m.closedAt,
    closedByName: m.closedBy?.name ?? null,
    amountClaimed: m.amountClaimed !== null ? m.amountClaimed.toString() : null,
  }));

  const workloadRows: WorkloadMatterRow[] = matters.map((m) => ({
    status: m.status,
    assignments: m.assignments.map((a) => ({ role: a.role, userName: a.user.name })),
  }));

  const distributionRows: DistributionRow[] = matters.map((m) => ({
    status: m.status,
    categoryId: m.categoryId,
    categoryName: m.category.name,
    forumId: m.forumId,
    forumName: m.forum?.name ?? null,
    leadId: m.assignments.find((a) => a.role === "LEAD")?.user.id ?? null,
    leadName: m.assignments.find((a) => a.role === "LEAD")?.user.name ?? null,
  }));

  const durationMatterRows: DurationMatterRow[] = matters.map((m) => ({ categoryName: m.category.name, createdAt: m.createdAt, closedAt: m.closedAt }));
  const durationStageRows: DurationStageRow[] = matters.flatMap((m) =>
    m.stageMoves.map((s) => ({ stageName: s.stageTemplate.name, enteredAt: s.enteredAt, exitedAt: s.exitedAt })),
  );

  const financialRows: FinancialRow[] = matters.map((m) => ({ categoryName: m.category.name, ucaaRole: m.ucaaRole, amountClaimed: m.amountClaimed, amountAgainst: m.amountAgainst }));

  const hearingRows: HearingRow[] = upcomingHearings.map((h) => ({
    id: h.id,
    matterId: h.matter!.id,
    matterReference: h.matter!.reference,
    matterTitle: h.matter!.title,
    title: h.title,
    startsAt: h.startsAt,
    forumName: h.forum?.name ?? null,
    courtroom: h.courtroom,
    assigneeName: h.assignee?.name ?? null,
  }));

  const deadlineRows: DeadlineRow[] = [
    ...overdueEntries.map((e) => ({
      id: `entry-${e.id}`,
      kind: "Calendar deadline" as const,
      matterId: e.matter!.id,
      matterReference: e.matter!.reference,
      matterTitle: e.matter!.title,
      title: e.title,
      dueAt: e.startsAt,
      assigneeName: e.assignee?.name ?? null,
    })),
    ...overdueTasks.map((t) => ({
      id: `task-${t.id}`,
      kind: "Task" as const,
      matterId: t.matter.id,
      matterReference: t.matter.reference,
      matterTitle: t.matter.title,
      title: t.title,
      dueAt: t.dueAt,
      assigneeName: t.assignee?.name ?? null,
    })),
  ];

  const inactiveCutoff = new Date(now.getTime() - inactiveDays * 24 * 60 * 60 * 1000);
  const inactiveRows: InactiveRow[] = matters
    .filter((m) => (m.status === "OPEN" || m.status === "ON_HOLD") && m.lastActivityAt < inactiveCutoff)
    .map((m) => ({
      id: m.id,
      reference: m.reference,
      title: m.title,
      status: m.status,
      leadName: m.assignments.find((a) => a.role === "LEAD")?.user.name ?? null,
      lastActivityAt: m.lastActivityAt,
    }))
    .sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime());

  const options: CaseFilterOptions = { categories, matterTypes, forums, lawyers, stages: stageRows.map((s) => s.name) };
  const query = new URLSearchParams(sp as Record<string, string>);
  query.delete("tab");

  function sortHref(key: SortKey) {
    const params = new URLSearchParams(sp as Record<string, string>);
    const nextDir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    params.set("sort", key);
    params.set("dir", nextDir);
    return `/reports?${params.toString()}`;
  }

  return (
    <>
      <PageHeader title="Reports" actions={<ReportExportButtons query={`tab=${tab}&${query.toString()}`} />} />

      <Card className="mb-4">
        <CaseFiltersBar filters={filters} options={options} hiddenFields={{ tab }} />
      </Card>

      <ReportTabs active={tab} query={query.toString()} />

      {tab === "register" && <CaseRegisterView rows={registerRows} filters={filters} sortHref={sortHref} />}
      {tab === "distribution" && <DistributionView rows={distributionRows} query={query.toString()} />}
      {tab === "outcomes" && <OutcomesView rows={outcomeRows} />}
      {tab === "durations" && <DurationsView matterRows={durationMatterRows} stageRows={durationStageRows} />}
      {tab === "financial" && <FinancialView rows={financialRows} />}
      {tab === "workload" && <WorkloadView rows={workloadRows} />}
      {tab === "hearings" && <HearingsView rows={hearingRows} />}
      {tab === "deadlines" && <DeadlinesView rows={deadlineRows} />}
      {tab === "inactive" && <InactiveView rows={inactiveRows} thresholdDays={inactiveDays} query={query.toString()} />}
    </>
  );
}
