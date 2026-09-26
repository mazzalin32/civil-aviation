import { Scale } from "lucide-react";

/** Login and every account-recovery screen: one clean card, no sidebar (spec §5.1). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div aria-hidden className="grid size-11 place-items-center rounded-control bg-primary text-on-primary">
            <Scale className="size-5" strokeWidth={1.8} />
          </div>
          <div>
            <b className="block font-serif text-lg font-semibold">CAA Legal</b>
            <small className="text-xs text-text-muted">Uganda Civil Aviation Authority</small>
          </div>
        </div>
        <div className="rounded-card border border-border bg-surface p-7 shadow-card">{children}</div>
      </div>
    </main>
  );
}
