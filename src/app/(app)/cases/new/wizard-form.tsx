"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2, Save, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import {
  courtSchema,
  identificationSchema,
  partiesSchema,
  positionSchema,
  representationSchema,
  serviceSchema,
  stageSchema,
  type WizardData,
} from "@/lib/validation/matter";
import { MAX_UPLOAD_BYTES } from "@/lib/validation/document";
import { uploadDocument } from "../[id]/tabs/documents-actions";
import { ProgressRail } from "./progress-rail";
import { IdentificationStep } from "./steps/identification-step";
import { PositionStep } from "./steps/position-step";
import { ServiceStep } from "./steps/service-step";
import { PartiesStep } from "./steps/parties-step";
import { CourtStep } from "./steps/court-step";
import { RepresentationStep, type LawyerOption } from "./steps/representation-step";
import { StageStep } from "./steps/stage-step";
import { DocumentsStep } from "./steps/documents-step";
import { ReviewStep } from "./steps/review-step";
import type { StepErrors } from "./steps/shared";
import { saveDraft, discardDraft, checkDuplicates, createMatter } from "./actions";
import { toast, withToast } from "@/components/ui/toast";

const STEPS = ["Matter identification", "CAA position & reporting", "Service / legal process", "Parties", "Court & judicial information", "Legal representation", "Matter stage", "Documents", "Review & submit"] as const;
const LAST = STEPS.length - 1;

type MatterTypeOption = { id: string; name: string; referencePrefix: string | null; stages: { id: string; name: string }[] };

/** Per-step validation. Steps without required fields (service, parties, court, documents) always pass. */
const STEP_SCHEMAS = [identificationSchema, positionSchema, serviceSchema, partiesSchema, courtSchema, representationSchema, stageSchema] as const;
const STEP_KEYS = ["identification", "position", "service", "parties", "court", "representation", "stage"] as const;

function todayInKampala() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(new Date());
}

export function WizardForm({
  categories,
  matterTypes,
  forums,
  lawyers,
  folders,
  initialDraft,
}: {
  categories: { id: string; name: string }[];
  matterTypes: MatterTypeOption[];
  forums: { id: string; name: string; division: string | null }[];
  lawyers: LawyerOption[];
  folders: { id: string; name: string }[];
  initialDraft: WizardData | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [data, setData] = useState<WizardData>(() => {
    const draft = initialDraft ?? { v: 2 as const };
    return { ...draft, v: 2, identification: { reportedDate: todayInKampala(), ...draft.identification } };
  });
  const [files, setFiles] = useState<File[]>([]);
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [showErrors, setShowErrors] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string; reference: string; title: string }[]>();
  const [ackDuplicates, setAckDuplicates] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const matterType = matterTypes.find((t) => t.id === data.identification?.matterTypeId);
  const stages = matterType?.stages ?? [];

  function scheduleSave(next: WizardData) {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      withToast(saveDraft(next), null).finally(() => setSaving(false));
    }, 700);
  }

  function patch<K extends (typeof STEP_KEYS)[number]>(key: K, value: WizardData[K]) {
    let next: WizardData = { ...data, v: 2, [key]: { ...data[key], ...value } };
    // A different matter type has different stages — drop a stage that no longer belongs to it.
    if (key === "identification" && (value as { matterTypeId?: string }).matterTypeId) {
      const nextType = matterTypes.find((t) => t.id === (value as { matterTypeId?: string }).matterTypeId);
      if (!nextType?.stages.some((s) => s.id === data.stage?.stageTemplateId)) next = { ...next, stage: { ...data.stage, stageTemplateId: "" } };
    }
    setData(next);
    setError(undefined);
    scheduleSave(next);
  }

  function errorsFor(i: number): StepErrors {
    if (i >= STEP_SCHEMAS.length) return {};
    const result = STEP_SCHEMAS[i].safeParse(data[STEP_KEYS[i]] ?? {});
    if (result.success) return {};
    const out: StepErrors = {};
    for (const issue of result.error.issues) out[String(issue.path[0])] ??= issue.message;
    return out;
  }
  const stepValid = (i: number) => Object.keys(errorsFor(i)).length === 0 && !(i === 7 && files.some((f) => f.size > MAX_UPLOAD_BYTES));

  function goTo(i: number) {
    setStep(i);
    setShowErrors(false);
    setError(undefined);
    setFurthest((f) => Math.max(f, i));
  }

  function next() {
    if (!stepValid(step)) {
      setShowErrors(true);
      setError("Complete the highlighted fields before continuing.");
      return;
    }
    goTo(Math.min(step + 1, LAST));
  }

  function submit() {
    const firstInvalid = STEP_KEYS.findIndex((_, i) => !stepValid(i));
    if (firstInvalid !== -1) {
      goTo(firstInvalid);
      setShowErrors(true);
      setError("Some required information is missing — it is highlighted below.");
      return;
    }
    startTransition(async () => {
      if (!ackDuplicates) {
        const names = [data.position?.partyName, ...(data.parties?.rows ?? []).map((r) => r.name)].filter((n): n is string => Boolean(n));
        const matches = await checkDuplicates(data.court?.courtCaseNo ?? "", names);
        if (matches.length > 0) return setDuplicates(matches);
      }
      const result = await withToast(createMatter({
        identification: identificationSchema.parse(data.identification),
        position: positionSchema.parse(data.position),
        service: serviceSchema.parse(data.service ?? {}),
        parties: partiesSchema.parse(data.parties ?? {}),
        court: courtSchema.parse(data.court ?? {}),
        representation: representationSchema.parse(data.representation),
        stage: stageSchema.parse(data.stage),
      }), "Case created");
      if ("error" in result) return setError(result.error);

      // The case exists now, so the files can go through the normal encrypted, virus-scanned upload.
      const failed: string[] = [];
      const targetFolder = folderId || result.defaultFolderId;
      for (const file of files) {
        const form = new FormData();
        form.set("matterId", result.matterId);
        form.set("folderId", targetFolder ?? "");
        form.set("confidentiality", data.stage?.confidentiality ?? "NORMAL");
        form.set("tags", "originating process");
        form.set("file", file);
        const res = await withToast(uploadDocument(form), "Document uploaded");
        if (res && "error" in res && res.error) failed.push(`${file.name}: ${res.error}`);
      }
      if (failed.length > 0) toast.error(`The case ${result.reference} was created, but some documents were not uploaded:\n\n${failed.join("\n")}\n\nYou can attach them from the case's Documents tab.`);
      router.push(`/cases/${result.matterId}${failed.length > 0 ? "?tab=documents" : ""}`);
    });
  }

  async function handleDiscard() {
    if (!window.confirm("Discard this draft? Everything entered so far will be lost.")) return;
    await withToast(discardDraft(), "Draft discarded");
    router.push("/cases");
  }

  const errors = showErrors ? errorsFor(step) : {};
  const forumName = forums.find((f) => f.id === data.court?.forumId)?.name;
  const leadName = lawyers.find((l) => l.id === data.representation?.leadUserId)?.name;

  return (
    <>
      <PageHeader
        title="New Matter"
        actions={
          <Button type="button" onClick={() => router.push("/cases")}>
            <X className="size-4" /> Save & exit
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        <ProgressRail steps={STEPS} current={step} furthest={furthest} saving={saving} onSelect={goTo} />

        <div className="min-w-0 rounded-card border border-border bg-surface shadow-card">
          <div className="border-b border-border px-7 py-3.5 text-[12px] font-medium text-text-muted">
            Step {step + 1} of {STEPS.length}
          </div>

          <div className="p-7">
            {step === 0 && <IdentificationStep value={data.identification ?? {}} onChange={(p) => patch("identification", p)} errors={errors} categories={categories} matterTypes={matterTypes} />}
            {step === 1 && <PositionStep value={data.position ?? {}} onChange={(p) => patch("position", p)} errors={errors} />}
            {step === 2 && <ServiceStep value={data.service ?? {}} onChange={(p) => patch("service", p)} position={data.position ?? {}} lawyers={lawyers} />}
            {step === 3 && <PartiesStep value={data.parties ?? {}} onChange={(p) => patch("parties", p)} />}
            {step === 4 && <CourtStep value={data.court ?? {}} onChange={(p) => patch("court", p)} forums={forums} />}
            {step === 5 && <RepresentationStep value={data.representation ?? {}} onChange={(p) => patch("representation", p)} errors={errors} lawyers={lawyers} />}
            {step === 6 && <StageStep value={data.stage ?? {}} onChange={(p) => patch("stage", p)} errors={errors} stages={stages} hasMatterType={Boolean(matterType)} />}
            {step === 7 && <DocumentsStep files={files} onFiles={setFiles} folders={folders} folderId={folderId} onFolder={setFolderId} />}
            {step === 8 && (
              <ReviewStep
                data={data}
                categoryName={categories.find((c) => c.id === data.identification?.categoryId)?.name}
                matterTypeName={matterType?.name}
                referencePrefix={matterType?.referencePrefix}
                stageName={stages.find((s) => s.id === data.stage?.stageTemplateId)?.name}
                forumName={forumName}
                leadName={leadName}
                supportNames={(data.representation?.supportUserIds ?? []).map((id) => lawyers.find((l) => l.id === id)?.name).filter((n): n is string => Boolean(n))}
                fileCount={files.length}
              />
            )}

            {duplicates && duplicates.length > 0 && (
              <div className="mt-6 rounded-card border border-warning/40 bg-warning-soft p-4 text-[13px]">
                <p className="m-0 mb-2 flex items-center gap-1.5 font-medium text-warning">
                  <TriangleAlert className="size-4" /> Possible duplicate{duplicates.length === 1 ? "" : "s"} found
                </p>
                <ul className="m-0 mb-3 list-disc pl-5">
                  {duplicates.map((m) => (
                    <li key={m.id}>
                      <Link href={`/cases?q=${encodeURIComponent(m.reference)}`} className="text-primary hover:underline" target="_blank">
                        {m.reference} — {m.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setAckDuplicates(true);
                      setDuplicates(undefined);
                    }}
                  >
                    Submit anyway
                  </Button>
                  <Button type="button" size="sm" onClick={() => setDuplicates(undefined)}>
                    <X className="size-4" /> Cancel
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <p className="m-0 mt-4 text-[13px] text-danger" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border px-7 py-4">
            <Button
              type="button"
              onClick={() => {
                setSaving(true);
                withToast(saveDraft(data), null).finally(() => setSaving(false));
              }}
            >
              <Save className="size-4" /> {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleDiscard} className="text-danger">
              Discard
            </Button>
            <div className="ml-auto flex gap-2">
              <Button type="button" onClick={() => goTo(Math.max(step - 1, 0))} disabled={step === 0}>
                <ArrowLeft className="size-4" /> Previous
              </Button>
              {step < LAST ? (
                <Button type="button" variant="primary" onClick={next}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button type="button" variant="primary" onClick={submit} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Submit case
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
