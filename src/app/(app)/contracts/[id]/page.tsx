import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireContractAccess } from "@/lib/authz";
import { ContractPanel } from "./contract-panel";
import { ContractDocumentsSection } from "./documents-section";

export const metadata = { title: "Contract" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireContractAccess(id);
  const isAdmin = me.role === "ADMIN";

  const [contract, lawyers, folders, documentsRaw, stages] = await Promise.all([
    db.contract.findUnique({
      where: { id },
      include: {
        category: true,
        currentStage: true,
        assignments: { where: { removedAt: null }, include: { user: { select: { id: true, name: true } } } },
        receiptStatus: true,
        legalReviewStatus: true,
        internalApprovalStatus: true,
        agVettingStatus: true,
        amendmentsStatus: true,
      },
    }),
    db.user.findMany({
      where: { role: "LAWYER", isActive: true },
      select: { id: true, name: true, _count: { select: { contractAssignments: { where: { removedAt: null, contract: { deletedAt: null } } } } } },
      orderBy: { name: "asc" },
    }),
    db.documentFolder.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.contractDocument.findMany({
      where: { contractId: id },
      include: { folder: true, uploadedBy: { select: { name: true } }, currentVersion: true, _count: { select: { versions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.contractStage.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!contract || contract.deletedAt) notFound();

  const myAssignment = contract.assignments.find((a) => a.user.id === me.id)?.role;
  const canEdit = isAdmin || myAssignment === "LEAD" || myAssignment === "SUPPORT";

  const team = contract.assignments.map((a) => ({ id: a.user.id, name: a.user.name, role: a.role }));
  const statusOptions = await getStatusOptions();

  return (
    <div>
      <Link href="/contracts" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-primary">
        <ArrowLeft className="size-3.5" /> Contracts
      </Link>

      <div className="mb-6">
        <h1 className="m-0 font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">{contract.title}</h1>
        <p className="mt-1 mb-0 text-[13px] text-text-muted">
          <span className="font-mono">{contract.reference}</span> · {contract.category.name} · {contract.counterpartyName}
        </p>
      </div>

      <div className="mb-6">
        <ContractPanel
          contractId={contract.id}
          data={{
            originatingDepartment: contract.originatingDepartment,
            dateOfReceipt: contract.dateOfReceipt?.toISOString() ?? null,
            dateSubmittedForReview: contract.dateSubmittedForReview?.toISOString() ?? null,
            receiptStatus: contract.receiptStatus ? { id: contract.receiptStatus.id, label: contract.receiptStatus.label } : null,
            legalReviewStatus: contract.legalReviewStatus ? { id: contract.legalReviewStatus.id, label: contract.legalReviewStatus.label } : null,
            internalApprovalStatus: contract.internalApprovalStatus ? { id: contract.internalApprovalStatus.id, label: contract.internalApprovalStatus.label } : null,
            agVettingStatus: contract.agVettingStatus ? { id: contract.agVettingStatus.id, label: contract.agVettingStatus.label } : null,
            amendmentsStatus: contract.amendmentsStatus ? { id: contract.amendmentsStatus.id, label: contract.amendmentsStatus.label } : null,
            caaExecutionStatus: contract.caaExecutionStatus,
            counterpartyExecutionStatus: contract.counterpartyExecutionStatus,
            dateOfSignature: contract.dateOfSignature?.toISOString() ?? null,
            dateOfFullExecution: contract.dateOfFullExecution?.toISOString() ?? null,
            commencementDate: contract.commencementDate?.toISOString() ?? null,
            expiryDate: contract.expiryDate?.toISOString() ?? null,
            outstandingAction: contract.outstandingAction,
            sourceUrl: contract.sourceUrl,
          }}
          statusOptions={statusOptions}
          stage={contract.currentStage ? { id: contract.currentStage.id, name: contract.currentStage.name } : null}
          stages={stages}
          team={team}
          lawyers={lawyers.map((l) => ({ id: l.id, name: l.name, workload: l._count.contractAssignments }))}
          canMutate={canEdit}
          isAdmin={isAdmin}
        />
      </div>

      <ContractDocumentsSection
        contractId={contract.id}
        folders={folders}
        isAdmin={isAdmin}
        canMutate={canEdit}
        documents={documentsRaw.map((d) => ({
          id: d.id,
          name: d.name,
          folderName: d.folder.name,
          tags: d.tags,
          confidentiality: d.confidentiality,
          currentVersionId: d.currentVersionId,
          versionCount: d._count.versions,
          size: d.currentVersion?.size ?? null,
          uploadedByName: d.uploadedBy.name,
          uploadedAt: d.createdAt.toISOString(),
          deletedAt: d.deletedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

async function getStatusOptions() {
  const options = await db.contractStatusOption.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
  const byCategory = (category: string) => options.filter((o) => o.category === category).map((o) => ({ id: o.id, label: o.label }));
  return {
    receipt: byCategory("RECEIPT"),
    legalReview: byCategory("LEGAL_REVIEW"),
    internalApproval: byCategory("INTERNAL_APPROVAL"),
    agVetting: byCategory("AG_VETTING"),
    amendments: byCategory("AMENDMENTS"),
  };
}
