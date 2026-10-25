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

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole("ADMIN");
  const sp = await searchParams;
  const filters = parseCaseFilters(sp);
  const tab = (typeof sp.tab === "string" ? sp.tab : "register") as ReportTab;
  const where = buildCaseWhere(filters, user.organizationId);

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
        amountClaimed: true,
        createdAt: true,
        lastActivityAt: true,
        closedAt: true,
        category: { select: { name: true } },
        matterType: { select: { name: true } },
        currentStage: { select: { name: true } },
        outcome: { select: { name: true } },
        closedBy: { select: { name: true } },
        assignments: { where: { removedAt: null }, select: { role: true, user: { select: { id: true, name: true } } } },
      },
    }),
    db.category.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.matterType.findMany({ where: { isActive: true, isSubProcess: false }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.forum.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "LAWYER", isActive: true, organizationId: orgId(user.organizationId) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.stageTemplate.findMany({ where: { isActive: true }, select: { name: true }, distinct: ["name"], orderBy: { name: "asc" } }),
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
      {tab === "outcomes" && <OutcomesView rows={outcomeRows} />}
      {tab === "workload" && <WorkloadView rows={workloadRows} />}
    </>
  );
}
