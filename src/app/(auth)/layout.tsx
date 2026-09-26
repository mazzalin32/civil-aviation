import { Scale } from "lucide-react";

/**
 * Split layout for every auth screen (login, activate, forgot/change password):
 * a solid brand panel on the left, the form on plain white on the right. On phones
 * the brand panel collapses to a small header band above the form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(320px,480px)_1fr]">
      <aside className="flex flex-col items-center justify-center gap-5 bg-primary px-8 py-10 text-center text-on-primary lg:min-h-dvh">
        <div aria-hidden className="grid size-16 place-items-center rounded-full bg-on-primary/15">
          <Scale className="size-8" strokeWidth={1.6} />
        </div>
        <div>
          <b className="block font-serif text-2xl font-semibold">CAA Legal</b>
          <p className="mx-auto mt-2 max-w-[32ch] text-sm text-on-primary/80">Uganda Civil Aviation Authority — Legal Department</p>
        </div>
        <p className="mx-auto mt-6 hidden max-w-[30ch] text-xs text-on-primary/70 lg:block">
          Private, internal system. Access is limited to Legal Department staff assigned by the Head of Legal.
        </p>
      </aside>

      <main className="flex items-center justify-center bg-surface px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
