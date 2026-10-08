import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { CaseFiltersBar, type CaseFilterOptions } from "./case-filters";
import { CaseRow, type CaseRowData } from "./case-row";
import { CreatedToast } from "./created-toast";
import { buildCaseOrderBy, buildCaseWhere, parseCaseFilters, PRIORITY_RANK, type SortKey } from "./filters";

export const metadata = { title: "Legal Matters" };

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "title", label: "Case" },
  { key: null, label: "Category & type" },
  { key: null, label: "Stage" },
  { key: "priority", label: "Priority" },
  { key: "value", label: "Value" },
  { key: null, label: "Team" },
  { key: null, label: "Status" },
  { key: "lastActivityAt", label: "Last activity" },
];

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole();
  const sp = await searchParams;
  const filters = parseCaseFilters(sp);
  const isAdmin = user.role === "ADMIN";
  // Everyone in the org sees every matter (prototype) — only case creation stays Admin-only.
  const created = typeof sp.created === "string" ? sp.created : undefined;

  const where = buildCaseWhere(filters);

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
        lastActivityAt: true,
        category: { select: { name: true } },
        matterType: { select: { name: true } },
        currentStage: { select: { name: true } },
        assignments: { where: { removedAt: null }, select: { role: true, user: { select: { id: true, name: true } } } },
      },
    }),
    db.category.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.matterType.findMany({ where: { isActive: true, isSubProcess: false }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.forum.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "LAWYER", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.stageTemplate.findMany({ where: { isActive: true }, select: { name: true }, distinct: ["name"], orderBy: { name: "asc" } }),
  ]);

  const rows: CaseRowData[] = matters.map((m) => {
    const lead = m.assignments.find((a) => a.role === "LEAD")?.user ?? null;
    const supportCount = m.assignments.filter((a) => a.role === "SUPPORT").length;
    return {
      id: m.id,
      reference: m.reference,
      title: m.title,
      categoryName: m.category.name,
      matterTypeName: m.matterType.name,
      stageName: m.currentStage?.name ?? null,
      priority: m.priority,
      status: m.status,
      amountClaimed: m.amountClaimed !== null ? m.amountClaimed.toString() : null,
      lead: lead ? { id: lead.id, name: lead.name } : null,
      supportCount,
      lastActivityAt: m.lastActivityAt.toISOString(),
    };
  });

  if (filters.sort === "priority") {
    rows.sort((a, b) => (filters.dir === "asc" ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]));
  }

  const options: CaseFilterOptions = {
    categories,
    matterTypes,
    forums,
    lawyers,
    stages: stageRows.map((s) => s.name),
  };

  function sortHref(key: SortKey) {
    const params = new URLSearchParams(sp as Record<string, string>);
    const nextDir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    params.set("sort", key);
    params.set("dir", nextDir);
    return `/cases?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Legal Matters"
        description="Every matter in the department."
        actions={
          isAdmin && (
            <Link href="/cases/new" className={buttonVariants({ variant: "primary" })}>
              <Plus className="size-4" /> New Matter
            </Link>
          )
        }
      />

      {created && <CreatedToast reference={created} />}

      <Card>
        <CaseFiltersBar filters={filters} options={options} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.label} className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">
                    {col.key ? (
                      <Link href={sortHref(col.key)} className="inline-flex items-center gap-1 hover:text-text">
                        {col.label}
                        {filters.sort === col.key && (filters.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </Link>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <CaseRow key={c.id} c={c} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className={cn("px-4 py-10 text-center text-text-muted")}>
                    No cases match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
