import { Poppins } from "next/font/google";

// Only the brand panel's two-line title uses this geometric face (matches the supplied reference).
const brandFont = Poppins({ subsets: ["latin"], weight: ["300", "500"], display: "swap" });

/**
 * Split layout for every auth screen (login, activate, forgot/change password):
 * a solid brand panel on the left, the form on plain white on the right. On phones
 * the brand panel collapses to a small header band above the form.
 *
 * Forced to the light tokens via inline vars — there's no signed-in user yet to have
 * picked a theme, and a system-dark browser was rendering this as a dark page, which
 * doesn't match the clean white reference look this screen is meant to have.
 */
const LIGHT_VARS = {
  "--bg": "#f7f6f3",
  "--surface": "#ffffff",
  "--surface-muted": "#f1efeb",
  "--border": "#e6e3dd",
  "--text": "#1f2328",
  "--text-muted": "#6b6760",
  "--primary": "#4169e1",
  "--primary-hover": "#3759bf",
  "--primary-soft": "#e8edfc",
  "--on-primary": "#ffffff",
  "--danger": "#c0392b",
  "--danger-soft": "#fbe9e7",
  colorScheme: "light",
} as React.CSSProperties;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={LIGHT_VARS} className="grid min-h-dvh lg:grid-cols-[minmax(380px,460px)_1fr]">
      <aside className="flex flex-col items-center bg-primary px-10 pt-20 pb-8 text-center text-on-primary lg:min-h-dvh">
        <div aria-hidden className="grid size-[220px] shrink-0 place-items-center rounded-full border-[6px] border-white/25 bg-white p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/CAA-Uganda-logo-1.png" alt="" width={168} height={80} style={{ display: "block", maxWidth: "100%", height: "auto" }} />
        </div>
        <h2 className={`${brandFont.className} m-0 mt-9 text-[28px] leading-[1.25] text-on-primary`}>
          <span className="block font-medium">Civil Aviation Authority</span>
          <span className="block font-light">Legal Department</span>
        </h2>

        <div className="flex-1" />

        <p className="m-0 max-w-[34ch] text-[15px] leading-relaxed font-semibold text-on-primary">
          Private, internal system.
          <br />
          Access is limited to Legal Department staff assigned by the Head of Legal.
        </p>
        <p className="m-0 mt-6 text-xs text-on-primary/60">CAA Legal — Case &amp; Matter Management {new Date().getFullYear()}</p>
      </aside>

      <main className="flex items-center justify-center bg-surface px-4 py-10 sm:px-8">
        <div className="w-full max-w-[480px]">{children}</div>
      </main>
    </div>
  );
}
