/** Title only, by design — no subtitle slot. A page's own content explains itself;
 *  the title doesn't need a sentence under it restating what the page already says. */
export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <h1 className="m-0 font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
      {actions && <div className="ml-auto flex gap-2">{actions}</div>}
    </div>
  );
}
