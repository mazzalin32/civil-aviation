"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SlideOver } from "@/components/ui/slide-over";
import { formatDate } from "@/lib/time";
import { updateContractDetail } from "./actions";
import { withToast } from "@/components/ui/toast";

export type ContractStatusOption = { id: string; label: string };

export type ContractDetail = {
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

export function ContractDetailsCard({
  matterId,
  detail,
  statusOptions,
  canMutate,
}: {
  matterId: string;
  detail: ContractDetail;
  statusOptions: {
    receipt: ContractStatusOption[];
    legalReview: ContractStatusOption[];
    internalApproval: ContractStatusOption[];
    agVetting: ContractStatusOption[];
    amendments: ContractStatusOption[];
  };
  canMutate: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="m-0 text-base font-semibold">Contract details</h2>
        {canMutate && (
          <Button type="button" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </div>
      <dl className="m-0 grid gap-2.5 text-[13px]">
        <Row label="Originating department" value={detail.originatingDepartment} />
        <Row label="Date of receipt" value={dOrDash(detail.dateOfReceipt)} />
        <Row label="Receipt status" value={detail.receiptStatus?.label} />
        <Row label="Submitted for legal review" value={dOrDash(detail.dateSubmittedForReview)} />
        <Row label="Legal review status" value={detail.legalReviewStatus?.label} />
        <Row label="Internal approval status" value={detail.internalApprovalStatus?.label} />
        <Row label="AG vetting status" value={detail.agVettingStatus?.label} />
        <Row label="Amendments status" value={detail.amendmentsStatus?.label} />
        <Row label="CAA execution" value={<Badge tone={detail.caaExecutionStatus === "SIGNED" ? "success" : "warning"}>{detail.caaExecutionStatus === "SIGNED" ? "Signed" : "Pending"}</Badge>} />
        <Row
          label="Counterparty execution"
          value={<Badge tone={detail.counterpartyExecutionStatus === "SIGNED" ? "success" : "warning"}>{detail.counterpartyExecutionStatus === "SIGNED" ? "Signed" : "Pending"}</Badge>}
        />
        <Row label="Date of signature" value={dOrDash(detail.dateOfSignature)} />
        <Row label="Date of full execution" value={dOrDash(detail.dateOfFullExecution)} />
        <Row label="Commencement date" value={dOrDash(detail.commencementDate)} />
        <Row label="Expiry date" value={dOrDash(detail.expiryDate)} />
      </dl>
      {detail.outstandingAction && (
        <p className="m-0 mt-3 rounded-[12px] bg-surface-muted px-3.5 py-3 text-[13px]">
          <span className="font-medium">Outstanding action: </span>
          {detail.outstandingAction}
        </p>
      )}

      <ContractDetailsEditor matterId={matterId} detail={detail} statusOptions={statusOptions} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function ContractDetailsEditor({
  matterId,
  detail,
  statusOptions,
  open,
  onClose,
}: {
  matterId: string;
  detail: ContractDetail;
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
      const result = await withToast(updateContractDetail({ matterId, ...Object.fromEntries(formData) }), "Contract details saved");
      if (result?.error) return setError(result.error);
      onClose();
    });
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Edit contract details">
      <form action={submit} className="grid gap-4">
        {error && <p className="m-0 text-xs text-danger">{error}</p>}

        <Field label="Originating department" htmlFor="cd-dept">
          <Input id="cd-dept" name="originatingDepartment" defaultValue={detail.originatingDepartment ?? ""} />
        </Field>

        <Field label="Date of receipt" htmlFor="cd-received">
          <Input id="cd-received" name="dateOfReceipt" type="date" defaultValue={detail.dateOfReceipt?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Receipt status" htmlFor="cd-receipt-status">
          <Select id="cd-receipt-status" name="receiptStatusId" defaultValue={detail.receiptStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.receipt.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Date submitted for legal review" htmlFor="cd-submitted">
          <Input id="cd-submitted" name="dateSubmittedForReview" type="date" defaultValue={detail.dateSubmittedForReview?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Legal review status" htmlFor="cd-legal-review">
          <Select id="cd-legal-review" name="legalReviewStatusId" defaultValue={detail.legalReviewStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.legalReview.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Internal approval status" htmlFor="cd-internal-approval">
          <Select id="cd-internal-approval" name="internalApprovalStatusId" defaultValue={detail.internalApprovalStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.internalApproval.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Attorney General vetting status" htmlFor="cd-ag-vetting">
          <Select id="cd-ag-vetting" name="agVettingStatusId" defaultValue={detail.agVettingStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.agVetting.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Amendments status" htmlFor="cd-amendments">
          <Select id="cd-amendments" name="amendmentsStatusId" defaultValue={detail.amendmentsStatus?.id ?? ""}>
            <option value="">Not set</option>
            {statusOptions.amendments.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="CAA execution status" htmlFor="cd-caa-exec">
          <Select id="cd-caa-exec" name="caaExecutionStatus" defaultValue={detail.caaExecutionStatus}>
            <option value="PENDING">Pending</option>
            <option value="SIGNED">Signed</option>
          </Select>
        </Field>
        <Field label="Counterparty execution status" htmlFor="cd-counterparty-exec">
          <Select id="cd-counterparty-exec" name="counterpartyExecutionStatus" defaultValue={detail.counterpartyExecutionStatus}>
            <option value="PENDING">Pending</option>
            <option value="SIGNED">Signed</option>
          </Select>
        </Field>

        <Field label="Date of signature" htmlFor="cd-signed">
          <Input id="cd-signed" name="dateOfSignature" type="date" defaultValue={detail.dateOfSignature?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Date of full execution" htmlFor="cd-full-exec">
          <Input id="cd-full-exec" name="dateOfFullExecution" type="date" defaultValue={detail.dateOfFullExecution?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Commencement date" htmlFor="cd-commence">
          <Input id="cd-commence" name="commencementDate" type="date" defaultValue={detail.commencementDate?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Expiry date" htmlFor="cd-expiry">
          <Input id="cd-expiry" name="expiryDate" type="date" defaultValue={detail.expiryDate?.slice(0, 10) ?? ""} />
        </Field>

        <Field label="Outstanding action required" htmlFor="cd-outstanding" hint="Shown on the contract's Overview panel.">
          <Textarea id="cd-outstanding" name="outstandingAction" defaultValue={detail.outstandingAction ?? ""} />
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
