"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { basicsSchema, forumStepSchema, partiesStepSchema, factsStepSchema, assignStepSchema, type WizardData } from "@/lib/validation/matter";
import { BasicsStep } from "./steps/basics-step";
import { ForumStep } from "./steps/forum-step";
import { PartiesStep } from "./steps/parties-step";
import { FactsStep } from "./steps/facts-step";
import { AssignStep, type LawyerOption } from "./steps/assign-step";
import { saveDraft, discardDraft, checkDuplicates, createMatter } from "./actions";

const STEPS = ["Basics", "Forum", "Parties", "Facts & value", "Assign & start"] as const;

type MatterTypeOption = { id: string; name: string; referencePrefix: string | null; stages: { id: string; name: string }[] };

export function WizardForm({
  categories,
  matterTypes,
  forums,
  lawyers,
  initialDraft,
}: {
  categories: { id: string; name: string }[];
  matterTypes: MatterTypeOption[];
  forums: { id: string; name: string; division: string | null }[];
  lawyers: LawyerOption[];
  initialDraft: WizardData | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialDraft ?? {});
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [duplicates, setDuplicates] = useState<{ id: string; reference: string; title: string }[]>();
  const [ackDuplicates, setAckDuplicates] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const selectedMatterType = matterTypes.find((t) => t.id === data.basics?.matterTypeId);
  const stages = selectedMatterType?.stages ?? [];

  function scheduleSave(next: WizardData) {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft(next).finally(() => setSaving(false));
    }, 700);
  }

  function patch<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    const next = { ...data, [key]: { ...data[key], ...value } };
    setData(next);
    setError(undefined);
    scheduleSave(next);
  }

  function stepIsValid(i: number): boolean {
    if (i === 0) return basicsSchema.safeParse(data.basics ?? {}).success;
    if (i === 1) return forumStepSchema.safeParse(data.forum ?? {}).success;
    if (i === 2) return partiesStepSchema.safeParse(data.parties ?? {}).success;
    if (i === 3) return factsStepSchema.safeParse(data.facts ?? {}).success;
    return assignStepSchema.safeParse(data.assign ?? {}).success;
  }

  function goNext() {
    if (!stepIsValid(step)) {
      setError("Check the highlighted fields before continuing.");
      return;
    }
    setError(undefined);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleCreate() {
    if (!stepIsValid(4)) return setError("Check the highlighted fields before continuing.");

    if (!ackDuplicates) {
      const names = (data.parties?.opposing ?? []).map((p) => p.name).filter(Boolean);
      const matches = await checkDuplicates(data.forum?.courtCaseNo ?? "", names);
      if (matches.length > 0) {
        setDuplicates(matches);
        return;
      }
    }

    startTransition(async () => {
      const result = await createMatter({
        basics: basicsSchema.parse(data.basics),
        forum: forumStepSchema.parse(data.forum ?? {}),
        parties: partiesStepSchema.parse(data.parties ?? {}),
        facts: factsStepSchema.parse(data.facts ?? {}),
        assign: assignStepSchema.parse(data.assign),
      });
      if ("error" in result) return setError(result.error);
      router.push(`/cases?created=${encodeURIComponent(result.reference)}`);
    });
  }

  function handleSaveAndExit() {
    router.push("/cases");
  }

  async function handleDiscard() {
    if (!window.confirm("Discard this draft? Everything entered so far will be lost.")) return;
    await discardDraft();
    router.push("/cases");
  }

  const progressPct = useMemo(() => (step / (STEPS.length - 1)) * 100, [step]);

  return (
    <>
      <PageHeader
        title="New case"
        description="Open a matter and assign the legal team."
        actions={
          <>
            <span className="self-center text-xs text-text-muted">{saving ? "Saving draft…" : "Draft saved"}</span>
            <Button type="button" onClick={handleSaveAndExit}>
              Save & exit
            </Button>
          </>
        }
      />

      <div className="mb-7">
        <div className="mb-3 flex items-center justify-between">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={cn("flex flex-1 flex-col items-center gap-1.5 text-center", i > 0 && "border-l border-border")}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-[13px] font-semibold",
                  i < step && "bg-success text-on-primary",
                  i === step && "bg-primary text-on-primary",
                  i > step && "bg-surface-muted text-text-muted",
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("text-xs", i === step ? "font-medium text-text" : "text-text-muted")}>{label}</span>
            </button>
          ))}
        </div>
        <div className="h-1 w-full rounded-full bg-surface-muted">
          <div className="h-1 rounded-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        {step === 0 && <BasicsStep value={data.basics ?? {}} onChange={(p) => patch("basics", p)} categories={categories} matterTypes={matterTypes} />}
        {step === 1 && <ForumStep value={data.forum ?? {}} onChange={(p) => patch("forum", p)} forums={forums} />}
        {step === 2 && <PartiesStep value={data.parties ?? {}} onChange={(p) => patch("parties", p)} />}
        {step === 3 && <FactsStep value={data.facts ?? {}} onChange={(p) => patch("facts", p)} />}
        {step === 4 && <AssignStep value={data.assign ?? {}} onChange={(p) => patch("assign", p)} lawyers={lawyers} stages={stages} />}

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
                Create anyway
              </Button>
              <Button type="button" size="sm" onClick={() => setDuplicates(undefined)}>
                <X className="size-4" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {error && <p className="m-0 mt-4 text-[13px] text-danger">{error}</p>}

        <div className="mt-7 flex items-center gap-2 border-t border-border pt-5">
          <Button type="button" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" variant="primary" onClick={goNext}>
              Next <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={handleCreate} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create case
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={handleDiscard} className="ml-auto text-danger">
            Discard draft
          </Button>
        </div>
      </div>
    </>
  );
}
