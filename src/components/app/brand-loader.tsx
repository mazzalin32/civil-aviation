/**
 * Full-screen loader: the CAA logo with a thin sweeping line beneath it. Used as the root
 * loading screen (first load, sign-in → dashboard) and as the overlay while signing in.
 * No hooks, so it renders instantly from the server with no client JS needed.
 */
export function BrandLoader({ label = "Loading CAA Legal" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="fixed inset-0 z-[200] grid place-items-center bg-bg">
      <div className="grid justify-items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/CAA-Uganda-logo-1.png" alt="" width={168} height={80} style={{ display: "block", width: 168, height: "auto" }} />
        <div className="h-[2px] w-40 overflow-hidden rounded-full bg-border">
          <div className="brand-loader-bar h-full w-1/3 rounded-full bg-primary" />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
