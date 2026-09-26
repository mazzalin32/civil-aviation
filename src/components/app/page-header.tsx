export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div>
        <h1 className="m-0 font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1 mb-0 text-[13px] text-text-muted">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex gap-2">{actions}</div>}
    </div>
  );
}
