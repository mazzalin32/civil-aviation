import type { ReactNode } from "react";

export type StepErrors = Record<string, string | undefined>;

/** Eyebrow + title + description shown at the top of every intake step. */
export function StepHeader({ step, eyebrow, title, description }: { step: number; eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-6">
      <p className="m-0 mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.1em] text-primary uppercase">
        <span className="h-px w-5 bg-primary" /> Step {step} · {eyebrow}
      </p>
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
      <p className="m-0 mt-1 text-[13px] text-text-muted">{description}</p>
    </header>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">{children}</div>;
}

/** Native <option> list from a plain string array. */
export function Options({ values, placeholder = "Select an option" }: { values: readonly string[]; placeholder?: string }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {values.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </>
  );
}
