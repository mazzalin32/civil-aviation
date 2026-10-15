import Link from "next/link";
import { FileX2, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Contracts" };

function Tile({ label, value, tone }: { label: string; value: number; tone?: "warning" | "danger" }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface p-4 shadow-card">
      <p className="m-0 text-[12.5px] text-text-muted">{label}</p>
      <p className={cn("mt-2 mb-0 text-[26px] leading-none font-semibold tabular-nums", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "")}>{value}</p>
    </div>
  );
}

export default async function ContractsPage() {
  const user = await requireRole();
  const isAdmin = user.role === "ADMIN";

  const contracts = await db.matter.findMany({
    where: { matterType: { name: "Contract" }, deletedAt: null },
    orderBy: { lastActivityAt: "desc" },
    include: {
      currentStage: true,
      assignments: { where: { removedAt: null, role: "LEAD" }, include: { user: { select: { name: true } } } },
      parties: { where: { roleInMatter: "Counterparty" }, take: 1 },
      contractDetail: { include: { legalReviewStatus: true, internalApprovalStatus: true, agVettingStatus: true, amendmentsStatus: true } },
    },
  });

  const now = new Date().getTime();
  const expiringWithin = (days: number) =>
    contracts.filter((c) => {
      const expiry = c.contractDetail?.expiryDate;
      if (!expiry) return false;
      const diff = expiry.getTime() - now;
      return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
    }).length;

  const kpis = [
    { label: "Total Contracts Registered", value: contracts.length },
    { label: "Under Legal Review", value: contracts.filter((c) => c.contractDetail?.legalReviewStatus?.label === "Under Legal Review").length },
    { label: "Awaiting Internal Approval", value: contracts.filter((c) => c.contractDetail?.internalApprovalStatus?.label === "Pending Approval").length },
    {
      label: "Pending Attorney General Vetting",
      value: contracts.filter((c) => {
        const label = c.contractDetail?.agVettingStatus?.label;
        return label && label !== "Not Required" && label !== "Cleared / No Objection Recorded";
      }).length,
    },
    {
      label: "Requiring Amendments",
      value: contracts.filter((c) => ["Amendments Required", "Amendments in Progress", "Amended Draft Submitted"].includes(c.contractDetail?.amendmentsStatus?.label ?? "")).length,
      tone: "warning" as const,
    },
    { label: "Awaiting CAA Signature", value: contracts.filter((c) => c.contractDetail?.caaExecutionStatus === "PENDING").length },
    { label: "Awaiting Counterparty Signature", value: contracts.filter((c) => c.contractDetail?.counterpartyExecutionStatus === "PENDING").length },
    { label: "Fully Executed", value: contracts.filter((c) => c.contractDetail?.caaExecutionStatus === "SIGNED" && c.contractDetail?.counterpartyExecutionStatus === "SIGNED").length },
    { label: "Active", value: contracts.filter((c) => c.currentStage?.name === "Active / In Force").length },
    { label: "Expiring Within 30 Days", value: expiringWithin(30), tone: "danger" as const },
    { label: "Expiring Within 60 Days", value: expiringWithin(60), tone: "warning" as const },
    { label: "Expiring Within 90 Days", value: expiringWithin(90) },
  ];

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Every contract the organisation has, tracked from receipt through legal review, approval, AG vetting and signature."
        actions={isAdmin ? <Link href="/contracts/new" className={buttonVariants({ variant: "primary" })}><Plus className="size-4" /> New contract</Link> : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Tile key={k.label} {...k} />
        ))}
      </div>

      {contracts.length === 0 ? (
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
        <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
          <table className="w-full min-w-[960px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-text-muted">
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Counterparty</th>
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
                const fullyExecuted = c.contractDetail?.caaExecutionStatus === "SIGNED" && c.contractDetail?.counterpartyExecutionStatus === "SIGNED";
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <Link href={`/cases/${c.id}`} className="font-medium text-text hover:text-primary">
                        {c.title}
                      </Link>
                      <div className="font-mono text-[11px] text-text-muted">{c.reference}</div>
                    </td>
                    <td className="px-4 py-3">{c.parties[0]?.name ?? "—"}</td>
                    <td className="px-4 py-3">{c.contractDetail?.legalReviewStatus?.label ?? "—"}</td>
                    <td className="px-4 py-3">{c.contractDetail?.internalApprovalStatus?.label ?? "—"}</td>
                    <td className="px-4 py-3">{c.contractDetail?.agVettingStatus?.label ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={fullyExecuted ? "success" : "warning"}>{fullyExecuted ? "Fully executed" : "Pending"}</Badge>
                    </td>
                    <td className="px-4 py-3">{c.currentStage?.name ?? "—"}</td>
                    <td className="px-4 py-3">{c.contractDetail?.expiryDate ? formatDate(c.contractDetail.expiryDate) : "—"}</td>
                    <td className="px-4 py-3">{c.assignments[0]?.user.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
