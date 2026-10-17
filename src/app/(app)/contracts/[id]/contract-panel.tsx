"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SlideOver } from "@/components/ui/slide-over";
import { Avatar } from "@/components/app/avatar";
import { formatDate } from "@/lib/time";
import { updateContract, moveContractStage, reassignContract, deleteContract } from "./actions";
import { withToast } from "@/components/ui/toast";

export type ContractStatusOption = { id: string; label: string };

export type ContractData = {
  originatingDepartment: string | null;
  dateOfReceipt: string | null;
  dateSubmittedForReview: string | null;
  receiptStatus: ContractStatusOption | null;
  legalReviewStatus: ContractStatusOption | null;
  internalApprovalStatus: ContractStatusOption | null;
  agVettingStatus: ContractStatusOption | null;
  amendmentsStatus: ContractStatusOption | null;
  caaExecutionStatus: "PENDING" | "SIGNED";
  counterpartyExecutionStatus: "PENDING" | "SIGNED";
  dateOfSignature: string | null;
  dateOfFullExecution: string | null;
  commencementDate: string | null;
  expiryDate: string | null;
  outstandingAction: string | null;
  sourceUrl: string | null;
};

const dOrDash = (v: string | null) => (v ? formatDate(new Date(v)) : "—");

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 max-w-[60%] text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export function ContractPanel({
  contractId,
  data,
  statusOptions,
  stage,
  stages,
  team,
  lawyers,
  canMutate,
  isAdmin,
}: {
  contractId: string;
  data: ContractData;
  statusOptions: {
    receipt: ContractStatusOption[];
    legalReview: ContractStatusOption[];
    internalApproval: ContractStatusOption[];
    agVetting: ContractStatusOption[];
    amendments: ContractStatusOption[];
  };
  stage: { id: string; name: string } | null;
  stages: { id: string; name: string }[];
  team: { id: string; name: string; role: "LEAD" | "SUPPORT" }[];
  lawyers: { id: string; name: string; workload: number }[];
  canMutate: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [stagePending, startStageTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  function onMoveStage(stageId: string) {
    if (!stageId || stageId === stage?.id) return;
    startStageTransition(async () => {
      await withToast(moveContractStage({ contractId, stageId }), "Lifecycle stage updated");
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this contract? It will be hidden everywhere but kept for audit — an Admin can be asked to restore it.")) return;
    startDeleteTransition(async () => {
      await withToast(deleteContract(contractId), "Contract deleted");
      router.push("/contracts");
    });
  }

  const fullyExecuted = data.caaExecutionStatus === "SIGNED" && data.counterpartyExecutionStatus === "SIGNED";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-base font-semibold">Contract details</h2>
          <Badge tone={fullyExecuted ? "success" : "warning"}>{fullyExecuted ? "Fully executed" : "Execution pending"}</Badge>
          {canMutate && (
            <Button type="button" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>

        <div className="mb-4">
          <Field label="Lifecycle stage" htmlFor="stage-move">
            <Select id="stage-move" value={stage?.id ?? ""} onChange={(e) => onMoveStage(e.target.value)} disabled={!canMutate || stagePending}>
              <option value="">Not set</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <dl className="m-0 grid gap-2.5 text-[13px]">
          <Row label="Originating department" value={data.originatingDepartment} />
          <Row label="Date of receipt" value={dOrDash(data.dateOfReceipt)} />
          <Row label="Receipt status" value={data.receiptStatus?.label} />
          <Row label="Submitted for legal review" value={dOrDash(data.dateSubmittedForReview)} />
          <Row label="Legal review status" value={data.legalReviewStatus?.label} />
          <Row label="Internal approval status" value={data.internalApprovalStatus?.label} />
          <Row label="AG vetting status" value={data.agVettingStatus?.label} />
          <Row label="Amendments status" value={data.amendmentsStatus?.label} />
          <Row label="CAA execution" value={<Badge tone={data.caaExecutionStatus === "SIGNED" ? "success" : "warning"}>{data.caaExecutionStatus === "SIGNED" ? "Signed" : "Pending"}</Badge>} />
          <Row
            label="Counterparty execution"
            value={<Badge tone={data.counterpartyExecutionStatus === "SIGNED" ? "success" : "warning"}>{data.counterpartyExecutionStatus === "SIGNED" ? "Signed" : "Pending"}</Badge>}
          />
          <Row label="Date of signature" value={dOrDash(data.dateOfSignature)} />
          <Row label="Date of full execution" value={dOrDash(data.dateOfFullExecution)} />
          <Row label="Commencement date" value={dOrDash(data.commencementDate)} />
          <Row label="Expiry date" value={dOrDash(data.expiryDate)} />
        </dl>

        {data.outstandingAction && (
          <p className="m-0 mt-3 rounded-[12px] bg-surface-muted px-3.5 py-3 text-[13px]">
            <span className="font-medium">Outstanding action: </span>
            {data.outstandingAction}
          </p>
        )}

        {data.sourceUrl && (
          <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
            <ExternalLink className="size-3.5" /> View source document
          </a>
        )}
      </div>

      <div className="grid content-start gap-4">
        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="m-0 text-base font-semibold">Team</h2>
            {canMutate && (
              <Button type="button" size="sm" className="ml-auto" onClick={() => setTeamOpen(true)}>
                <UserPlus className="size-3.5" /> Add
              </Button>
            )}
          </div>
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {team.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 text-[13px]">
                <Avatar name={t.name} />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <Badge tone={t.role === "LEAD" ? "info" : "neutral"}>{t.role === "LEAD" ? "Lead" : "Support"}</Badge>
              </li>
            ))}
          </ul>
        </div>

        {isAdmin && (
          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="m-0 mb-3 text-base font-semibold">Danger zone</h2>
            <Button type="button" variant="secondary" disabled={deletePending} onClick={onDelete}>
              <Trash2 className="size-3.5" /> Delete contract
            </Button>
          </div>
        )}
      </div>

      <ContractEditor
        contractId={contractId}
        data={data}
        statusOptions={statusOptions}
        open={editing}
        onClose={() => setEditing(false)}
      />
      <TeamEditor
        contractId={contractId}
        lawyers={lawyers}
        currentLeadId={team.find((t) => t.role === "LEAD")?.id}
        currentSupportIds={team.filter((t) => t.role === "SUPPORT").map((t) => t.id)}
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
      />
    </div>
  );
}

function ContractEditor({
  contractId,
  data,
  statusOptions,
  open,
  onClose,
}: {
  contractId: string;
  data: ContractData;
  statusOptions: {
    receipt: ContractStatusOption[];
    legalReview: ContractStatusOption[];
    internalApproval: ContractStatusOption[];
    agVetting: ContractStatusOption[];
    amendments: ContractStatusOption[];
  };
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(updateContract({ contractId, ...Object.fromEntries(formData) }), "Contract details saved");
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Edit contract details">
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}

        <Field label="Originating department" htmlFor="cd-dept">
          <Input id="cd-dept" name="originatingDepartment" defaultValue={data.originatingDepartment ?? ""} />
        </Field>

        <Field label="Date of receipt" htmlFor="cd-received">
          <Input id="cd-received" name="dateOfReceipt" type="date" defaultValue={data.dateOfReceipt?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Receipt status" htmlFor="cd-receipt-status">
          <Select id="cd-receipt-status" name="receiptStatusId" defaultValue={data.receiptStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.receipt.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Date submitted for legal review" htmlFor="cd-submitted">
          <Input id="cd-submitted" name="dateSubmittedForReview" type="date" defaultValue={data.dateSubmittedForReview?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Legal review status" htmlFor="cd-legal-review">
          <Select id="cd-legal-review" name="legalReviewStatusId" defaultValue={data.legalReviewStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.legalReview.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Internal approval status" htmlFor="cd-internal-approval">
          <Select id="cd-internal-approval" name="internalApprovalStatusId" defaultValue={data.internalApprovalStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.internalApproval.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Attorney General vetting status" htmlFor="cd-ag-vetting">
          <Select id="cd-ag-vetting" name="agVettingStatusId" defaultValue={data.agVettingStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.agVetting.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Amendments status" htmlFor="cd-amendments">
          <Select id="cd-amendments" name="amendmentsStatusId" defaultValue={data.amendmentsStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.amendments.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="CAA execution status" htmlFor="cd-caa-exec">
          <Select id="cd-caa-exec" name="caaExecutionStatus" defaultValue={data.caaExecutionStatus}>
            <option value="PENDING">Pending</option>
            <option value="SIGNED">Signed</option>
          </Select>
        </Field>
        <Field label="Counterparty execution status" htmlFor="cd-counterparty-exec">
          <Select id="cd-counterparty-exec" name="counterpartyExecutionStatus" defaultValue={data.counterpartyExecutionStatus}>
            <option value="PENDING">Pending</option>
            <option value="SIGNED">Signed</option>
          </Select>
        </Field>

        <Field label="Date of signature" htmlFor="cd-signed">
          <Input id="cd-signed" name="dateOfSignature" type="date" defaultValue={data.dateOfSignature?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Date of full execution" htmlFor="cd-full-exec">
          <Input id="cd-full-exec" name="dateOfFullExecution" type="date" defaultValue={data.dateOfFullExecution?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Commencement date" htmlFor="cd-commence">
          <Input id="cd-commence" name="commencementDate" type="date" defaultValue={data.commencementDate?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Expiry date" htmlFor="cd-expiry">
          <Input id="cd-expiry" name="expiryDate" type="date" defaultValue={data.expiryDate?.slice(0, 10) ?? ""} />
        </Field>

        <Field label="Source document link" htmlFor="cd-source" hint="e.g. a link to the filed/signed document.">
          <Input id="cd-source" name="sourceUrl" type="url" defaultValue={data.sourceUrl ?? ""} placeholder="https://…" />
        </Field>

        <Field label="Outstanding action required" htmlFor="cd-outstanding">
          <Textarea id="cd-outstanding" name="outstandingAction" defaultValue={data.outstandingAction ?? ""} />
        </Field>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}

function TeamEditor({
  contractId,
  lawyers,
  currentLeadId,
  currentSupportIds,
  open,
  onClose,
}: {
  contractId: string;
  lawyers: { id: string; name: string; workload: number }[];
  currentLeadId?: string;
  currentSupportIds: string[];
  open: boolean;
  onClose: () => void;
}) {
  const [leadId, setLeadId] = useState(currentLeadId ?? "");
  const [supportIds, setSupportIds] = useState<string[]>(currentSupportIds);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function toggleSupport(id: string) {
    setSupportIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await withToast(reassignContract({ contractId, leadUserId: leadId, supportUserIds: supportIds }), "Contract team updated");
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Contract team — add or change people">
      <div className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}
        <Field label="Lead lawyer" htmlFor="ct-lead">
          <Select id="ct-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Select a lawyer</option>
            {lawyers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.workload} contract{l.workload === 1 ? "" : "s"}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Supporting lawyers</span>
          <div className="grid gap-2 rounded-control border border-border p-3 sm:grid-cols-2">
            {lawyers.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={supportIds.includes(l.id)} disabled={l.id === leadId} onChange={() => toggleSupport(l.id)} className="size-4 accent-primary" />
                {l.name}
                {l.id === leadId && <span className="text-text-muted">(lead)</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="button" variant="primary" disabled={pending || !leadId} onClick={submit}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    </SlideOver>
  );
}
