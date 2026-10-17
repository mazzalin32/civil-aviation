import Link from "next/link";
import { FileSpreadsheet, FileX2, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { parseContractFilters, buildContractWhere } from "./filters";
import { ContractFiltersBar } from "./contract-filters";
import { BarList } from "./bar-list";

export const metadata = { title: "Contracts" };

function Tile({ label, value, tone }: { label: string; value: number; tone?: "warning" | "danger" }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface p-4 shadow-card">
      <p className="m-0 text-[12.5px] text-text-muted">{label}</p>
      <p className={cn("mt-2 mb-0 text-[26px] leading-none font-semibold tabular-nums", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "")}>{value}</p>
    </div>
  );
}

function countBy<T>(rows: T[], keyOf: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export default async function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole();
  const isAdmin = user.role === "ADMIN";
  const sp = await searchParams;
  const filters = parseContractFilters(sp);
  const where = buildContractWhere(filters);

  const [contracts, categories, allDepartments, allStages, agVettingOptions, internalApprovalOptions] = await Promise.all([
    db.contract.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      include: {
        category: true,
        currentStage: true,
        assignments: { where: { removedAt: null, role: "LEAD" }, include: { user: { select: { name: true } } } },
        legalReviewStatus: true,
        internalApprovalStatus: true,
        agVettingStatus: true,
        amendmentsStatus: true,
      },
    }),
    db.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.contract.findMany({ where: { originatingDepartment: { not: null }, deletedAt: null }, distinct: ["originatingDepartment"], select: { originatingDepartment: true } }),
    db.contractStage.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { name: true } }),
    db.contractStatusOption.findMany({ where: { isActive: true, category: "AG_VETTING" }, orderBy: { order: "asc" }, select: { id: true, label: true } }),
    db.contractStatusOption.findMany({ where: { isActive: true, category: "INTERNAL_APPROVAL" }, orderBy: { order: "asc" }, select: { id: true, label: true } }),
  ]);

  const now = new Date().getTime();
  const expiringWithin90 = contracts.filter((c) => {
    const expiry = c.expiryDate;
    if (!expiry) return false;
    const diff = expiry.getTime() - now;
    return diff >= 0 && diff <= 90 * 24 * 60 * 60 * 1000;
  }).length;

  const kpis = [
    { label: "Total Contracts", value: contracts.length },
    { label: "Under Legal Review", value: contracts.filter((c) => c.legalReviewStatus?.label === "Under Legal Review").length },
    { label: "Awaiting Internal Approval", value: contracts.filter((c) => c.internalApprovalStatus?.label === "Pending Approval").length },
    {
      label: "Pending AG Vetting",
      value: contracts.filter((c) => {
        const label = c.agVettingStatus?.label;
        return label && label !== "Not Required" && label !== "Cleared / No Objection Recorded";
      }).length,
    },
    {
      label: "Requiring Amendments",
      value: contracts.filter((c) => ["Amendments Required", "Amendments in Progress", "Amended Draft Submitted"].includes(c.amendmentsStatus?.label ?? "")).length,
      tone: "warning" as const,
    },
    {
      label: "Awaiting Signature",
      value: contracts.filter((c) => c.caaExecutionStatus === "PENDING" || c.counterpartyExecutionStatus === "PENDING").length,
    },
    { label: "Fully Executed", value: contracts.filter((c) => c.caaExecutionStatus === "SIGNED" && c.counterpartyExecutionStatus === "SIGNED").length },
    { label: "Active Contracts", value: contracts.filter((c) => c.currentStage?.name === "Active / In Force").length },
    { label: "Expiring Within 90 Days", value: expiringWithin90, tone: expiringWithin90 > 0 ? ("warning" as const) : undefined },
  ];

  const byType = countBy(contracts, (c) => c.category.name);
  const byStage = countBy(contracts, (c) => c.currentStage?.name);
  const byAgVetting = countBy(contracts, (c) => c.agVettingStatus?.label);

  const departments = allDepartments.map((d) => d.originatingDepartment!).sort();
  const exportQuery = new URLSearchParams(sp as Record<string, string>).toString();
  const hasActiveFilters = Boolean(filters.q || filters.categoryId || filters.department || filters.stage || filters.agVettingStatusId || filters.internalApprovalStatusId);

  return (
    <div>
      <PageHeader
        title="Contracts register"
        description="Every contract the organisation has, tracked from receipt through legal review, approval, AG vetting and signature."
        actions={
          <>
            <a href={`/api/contracts/export${exportQuery ? `?${exportQuery}` : ""}`} className={buttonVariants({ variant: "secondary" })} title="Export Excel">
              <FileSpreadsheet className="size-4" />
              <span className="hidden sm:inline">Export</span>
            </a>
            {isAdmin && (
              <Link href="/contracts/new" className={buttonVariants({ variant: "primary" })}>
                <Plus className="size-4" /> New contract
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Tile key={k.label} {...k} />
        ))}
      </div>

      {contracts.length === 0 && !hasActiveFilters ? (
        <div className="grid place-items-center gap-3 rounded-card border border-dashed border-border bg-surface-muted p-12 text-center">
          <FileX2 className="size-8 text-text-muted" strokeWidth={1.5} />
          <p className="m-0 text-[13.5px] text-text-muted">No contracts registered yet.</p>
          {isAdmin && (
            <Link href="/contracts/new" className={buttonVariants({ variant: "primary" })}>
              <Plus className="size-4" /> New contract
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <BarList title="Contracts by Type" rows={byType} />
            <BarList title="Contracts by Lifecycle Stage" rows={byStage} />
            <BarList title="AG Vetting Status" rows={byAgVetting} />
          </div>

          <ContractFiltersBar
            filters={filters}
            options={{ categories, departments, stages: allStages.map((s) => s.name), agVettingStatuses: agVettingOptions, internalApprovalStatuses: internalApprovalOptions }}
          />

          {contracts.length === 0 ? (
            <div className="grid place-items-center gap-2 rounded-card border border-dashed border-border bg-surface-muted p-10 text-center">
              <p className="m-0 text-[13.5px] text-text-muted">No contracts match these filters.</p>
              <Link href="/contracts" className="text-[13px] font-medium text-primary hover:underline">Clear filters</Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
              <table className="w-full min-w-[1040px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[12px] text-text-muted">
                    <th className="px-4 py-3 font-medium">Contract</th>
                    <th className="px-4 py-3 font-medium">Counterparty</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Received</th>
                    <th className="px-4 py-3 font-medium">Legal review</th>
                    <th className="px-4 py-3 font-medium">Internal approval</th>
                    <th className="px-4 py-3 font-medium">AG vetting</th>
                    <th className="px-4 py-3 font-medium">Execution</th>
                    <th className="px-4 py-3 font-medium">Lifecycle</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                    <th className="px-4 py-3 font-medium">Responsible officer</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => {
                    const fullyExecuted = c.caaExecutionStatus === "SIGNED" && c.counterpartyExecutionStatus === "SIGNED";
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                        <td className="px-4 py-3">
                          <Link href={`/contracts/${c.id}`} className="font-medium text-text hover:text-primary">
                            {c.title}
                          </Link>
                          <div className="font-mono text-[11px] text-text-muted">{c.reference}</div>
                        </td>
                        <td className="px-4 py-3">{c.counterpartyName}</td>
                        <td className="px-4 py-3">{c.category.name}</td>
                        <td className="px-4 py-3">{c.originatingDepartment ?? "—"}</td>
                        <td className="px-4 py-3">{c.dateOfReceipt ? formatDate(c.dateOfReceipt) : "—"}</td>
                        <td className="px-4 py-3">{c.legalReviewStatus?.label ?? "—"}</td>
                        <td className="px-4 py-3">{c.internalApprovalStatus?.label ?? "—"}</td>
                        <td className="px-4 py-3">{c.agVettingStatus?.label ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={fullyExecuted ? "success" : "warning"}>{fullyExecuted ? "Fully executed" : "Pending"}</Badge>
                        </td>
                        <td className="px-4 py-3">{c.currentStage?.name ?? "—"}</td>
                        <td className="px-4 py-3">{c.expiryDate ? formatDate(c.expiryDate) : "—"}</td>
                        <td className="px-4 py-3">{c.assignments[0]?.user.name ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
