"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { confirmImport, previewImport, revalidateGrid, type ConfirmResult } from "./actions";
import { FIELD_KEYS, type ColumnMapping, type FieldKey, type ParsedRow } from "./parse";
import { withToast } from "@/components/ui/toast";

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  title: "Title",
  department: "Department",
  practisingCertNo: "Practising cert. no.",
  certExpiry: "Cert. expiry",
};

type Step = { name: "upload" } | { name: "preview"; headerRow: string[]; grid: string[][]; mapping: ColumnMapping; rows: ParsedRow[] } | { name: "result"; result: ConfirmResult };

function downloadErrorReport(rows: ParsedRow[]) {
  const bad = rows.filter((r) => r.errors.length > 0);
  const csv = ["Row,Name,Email,Errors", ...bad.map((r) => `${r.row},"${r.name}","${r.email}","${r.errors.join("; ")}"`)].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import-errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>({ name: "upload" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onUpload(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await previewImport(formData);
      if ("error" in result) return setError(result.error);
      setStep({ name: "preview", ...result });
    });
  }

  function onRemap(field: FieldKey, value: string) {
    if (step.name !== "preview") return;
    const mapping: ColumnMapping = { ...step.mapping, [field]: value === "" ? undefined : Number(value) };
    startTransition(async () => {
      const rows = await revalidateGrid(step.grid, mapping);
      setStep({ ...step, mapping, rows });
    });
  }

  function onConfirm() {
    if (step.name !== "preview") return;
    startTransition(async () => {
      const result = await withToast(confirmImport(step.rows), "Users imported");
      if ("error" in result) return setError(result.error);
      setStep({ name: "result", result });
    });
  }

  if (step.name === "upload") {
    return (
      <div className="grid gap-6 rounded-card border border-border bg-surface p-6">
        <div>
          <h2 className="m-0 mb-1 text-base font-semibold">1. Download the template</h2>
          <p className="m-0 text-[13px] text-text-muted">
            Column headers can be renamed or reordered — import matches them flexibly (e.g. &quot;Full Name&quot; or &quot;Lawyer Name&quot; both work).
          </p>
          <a href="/api/users/import-template" className={`${buttonVariants({ variant: "secondary" })} mt-3`}>
            <Download className="size-4" /> Download template (.xlsx)
          </a>
        </div>
        <div className="border-t border-border pt-6">
          <h2 className="m-0 mb-1 text-base font-semibold">2. Upload your filled-in file</h2>
          {error && <p className="m-0 mb-2 text-[13px] text-danger">{error}</p>}
          <form action={onUpload} className="flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".xlsx" required className="text-[13px]" />
            <Button type="submit" variant="primary" disabled={pending}>
              <Upload className="size-4" /> {pending ? "Reading…" : "Upload"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (step.name === "preview") {
    const okCount = step.rows.filter((r) => r.errors.length === 0).length;
    const badCount = step.rows.length - okCount;
    return (
      <div className="grid gap-5">
        <div className="rounded-card border border-border bg-surface p-5">
          <h2 className="m-0 mb-3 text-base font-semibold">Match your columns</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELD_KEYS.map((field) => (
              <label key={field} className="grid gap-1 text-[13px]">
                <span className="text-text-muted">
                  {FIELD_LABELS[field]}
                  {(field === "name" || field === "email") && <span className="text-danger"> *</span>}
                </span>
                <Select value={step.mapping[field] ?? ""} onChange={(e) => onRemap(field, e.target.value)}>
                  <option value="">— not mapped —</option>
                  {step.headerRow.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge tone="success">{okCount} ready to import</Badge>
          {badCount > 0 && <Badge tone="danger">{badCount} with errors</Badge>}
          {badCount > 0 && (
            <button type="button" onClick={() => downloadErrorReport(step.rows)} className="text-[13px] text-primary hover:underline">
              Download error report
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-medium text-text-muted">Row</th>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-medium text-text-muted">Name</th>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-medium text-text-muted">Email</th>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-medium text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {step.rows.map((r) => (
                <tr key={r.row} className={r.errors.length > 0 ? "bg-danger-soft/40" : undefined}>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{r.row}</td>
                  <td className="border-b border-border px-3 py-2">{r.name || "—"}</td>
                  <td className="border-b border-border px-3 py-2">{r.email || "—"}</td>
                  <td className="border-b border-border px-3 py-2">
                    {r.errors.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="size-3.5" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-danger">
                        <AlertCircle className="size-3.5" /> {r.errors.join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="m-0 text-[13px] text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button variant="primary" onClick={onConfirm} disabled={pending || okCount === 0}>
            {pending ? "Importing…" : `Import ${okCount} lawyer${okCount === 1 ? "" : "s"}`}
          </Button>
          <Button onClick={() => setStep({ name: "upload" })} disabled={pending}>
            <ArrowLeft className="size-4" /> Start over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-card border border-border bg-surface p-6 text-center">
      <CheckCircle2 className="mx-auto size-10 text-success" />
      <h2 className="m-0 text-lg font-semibold">Import complete</h2>
      <p className="m-0 text-[13px] text-text-muted">
        {step.result.created} lawyer{step.result.created === 1 ? "" : "s"} added and invited.
        {step.result.skipped > 0 && ` ${step.result.skipped} row(s) skipped — see the error report from the previous step.`}
      </p>
      <div className="flex justify-center gap-2">
        <Link href="/users" className={buttonVariants({ variant: "primary" })}>
          Go to Users
        </Link>
        <Button onClick={() => setStep({ name: "upload" })}>Import another file</Button>
      </div>
    </div>
  );
}
