export function FormSection({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">{step}</span>
        <h3 className="m-0 whitespace-nowrap text-[11px] font-semibold tracking-wide text-text-muted uppercase">{title}</h3>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
