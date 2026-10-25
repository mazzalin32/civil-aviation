import type { ReactNode } from "react";

export type StepErrors = Record<string, string | undefined>;

/** The step's title — just the title, nothing under it (the wizard's own step counter
 *  and rail already give the reader their place; a step doesn't need its own blurb too). */
export function StepHeader({ title }: { title: string }) {
  return (
    <header className="mb-6">
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
    </header>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
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
