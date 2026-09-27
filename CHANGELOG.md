# Changelog

## Phase 0 — Setup (2026-09-26)

### Added
- Next.js 16 (App Router), strict TypeScript, Tailwind v4, ESLint, Prettier, Vitest.
- Design tokens from spec §10 in `src/app/globals.css`: light and dark themes, avatar and status colours. shadcn/ui colour names map onto the same tokens.
- Fonts: Inter (UI) and Source Serif 4 (page titles).
- App shell matching the case-page mockup: sidebar with a nav for each role, top bar with search hint (Ctrl K / ⌘K), "New case" for Admin, notifications bell, user card, and a mobile menu below the desktop breakpoint.
- Placeholder pages for every nav item, each with an empty state. Shared loading skeleton, error, 403 and 404 screens.
- `requireRole()` role gate. Admin-only pages redirect lawyers to a 403 screen.
- Dev-only **role switch**, because login doesn't exist yet. Phase 1 removes it.
- Prisma 7 with the PostgreSQL adapter. Schema contains `User`, `Setting` and append-only `AuditLog`. `writeAudit()` helper.
- Seed: first Admin (flagged to change password) and 4 sample lawyers. Certificate expiry dates are relative to today.
- Docker Compose with Postgres 17 on port 5460 and Mailpit. Object storage and ClamAV sit behind the `storage` and `scan` profiles until Phase 6. There's also an `app` profile and a production Dockerfile.
- Baseline security headers.

### Notes
- MinIO no longer publishes images on Docker Hub. The S3-compatible storage image gets picked in Phase 6.

## Phase 1 — Auth & security base (2026-09-26)

### Added
- Better Auth (email + password, no public sign-up) with the `twoFactor` (TOTP + backup codes) and `haveIBeenPwned` (rejects breached passwords) plugins. `Session`, `Account`, `Verification`, `TwoFactor` tables added to the schema.
- Login screen, matching the design mockup: one centred card, no sidebar.
- One reset-password mechanism serves both a lawyer's first-time invite and any later "forgot password" — same 72-hour single-use link, different email wording (spec §15 decision).
- Mandatory 2FA: a QR code + 10 backup codes, confirmed with a live code before the gate lets the user through. Applies to a lawyer's first login and after an Admin resets someone's 2FA.
- Forced password change for the seeded Admin's temporary password.
- Account lockout: 5 failed attempts locks for 15 minutes; the Admin gets an email alert. Pure lockout logic is unit-tested (`src/lib/lockout.ts`).
- Session idle timeout: 15 minutes since the last request (`expiresIn`/`updateAge` on the Better Auth session).
- `src/proxy.ts` (Next 16 renamed `middleware.ts`) gates every route: signed out → `/login`; mid-onboarding → forced to `/change-password` or `/2fa/setup` first.
- Every auth event writes an `AuditLog` row: login, failed login, lockout, password change, 2FA enabled, sign-out.
- Sign-out button in the sidebar.
- Seed: the Admin gets a real temporary password; each lawyer gets a live activation link, emailed to Mailpit.

### Removed
- The dev-only role switch and its cookie — real accounts and real sessions now.

### Fixed while verifying
- npm resolved `prisma` and `typescript` to unstable pre-release "latest" tags in Phase 0; pinned both to their real stable releases.
- `react`/`react-dom` had drifted to different patch versions; pinned to match.
- `confirmTwoFactorSetup` read the signed-in user *after* calling `verifyTOTP`, which rotates the session on first confirmation — by then the request's own cookie was already stale, so the confirmation silently failed to record. Fixed by reading the user first.

### Verified end-to-end (real HTTP requests against a running server, not just unit tests)
Admin: temporary password → forced change → rejected on a breached password → 2FA setup (QR, backup codes, live TOTP confirmation) → dashboard. Lawyer: seeded invite link → set password → forced 2FA setup → My Day. Login: wrong password, wrong 2FA code, 5-failure lockout with the Admin email alert in Mailpit, then correct password + correct 2FA code all the way to a real session. Confirmed via the audit log and direct database checks, not just HTTP status codes.

## Phase 1 follow-up — design feedback from live testing (2026-09-26)

### Changed
- Primary colour is now Royal Blue `#4169E1` (tried a brighter `#1F51FF` first; settled on Royal Blue). Updated everywhere: tokens, avatar accents, email templates, design docs.
- Login and every auth screen use a split layout (brand panel + white form), matching the reference the client shared, instead of a single centred card.
- Input fields are sharp-cornered (`rounded-none`); cards and buttons keep their rounded corners.
- The sidebar is now filled with the brand blue (previously white with a blue accent), matching the login panel.
- Sidebar is collapsible to icons-only, with hover tooltips for each link. The toggle lives right under the logo — always visible — not at the bottom, since it would get pushed out of view as more nav links are added. Remembers the choice via `localStorage`.
- Top-bar search button shortened to just "Search" instead of a full sentence.
- Added a show/hide (eye) toggle to every password field.
- The app is pinned to the light theme for now (`data-theme="light"`) rather than following the OS setting, since dark mode isn't fully dialled in yet and was confusing during testing. Revisit once Profile & preferences (with a real theme switch) exists.
- Added `REQUIRE_2FA` env flag (default `true`) so 2FA enforcement can be switched off for local testing without touching any code. **Must be `true` before go-live** — the spec requires 2FA on every account.

### Fixed
- The seeded Admin's temporary password had characters that are easy to mistype or that a password manager can mangle; replaced with a plain, unambiguous one for local testing.

## Phase 2 — Admin Settings (2026-09-26)

### Added
- Schema: `Category`, `MatterType` + `StageTemplate`, `Forum`, `EventType`, `DocumentFolder`, `Outcome`, `NotificationRule`, `ReferenceCounter`. Everything legal stays data, never hard-coded (CLAUDE.md).
- Settings portal at `/settings`, six tabs:
  - **Categories** — subject a matter is about; colour, reorder, deactivate.
  - **Matter types & lifecycles** — process/lifecycle a matter follows, including the four sub-process templates (Interlocutory application, Appeal, Execution, Taxation of costs). Each type links to its own stage editor (add, rename, reorder, mark which stages allow closure, required-field keys per stage).
  - **Courts & forums** — Uganda's court/tribunal hierarchy (spec §3).
  - **Event & document types** — timeline event kinds and document folders.
  - **Outcomes** — Won, Lost, Settled, …
  - **Reminder schedules** — offsets/channels per trigger, and whether a lawyer can mute it. Sending reminders is Phase 8; this is just the schedule.
- Every add/rename/deactivate/reorder writes an audit log entry with before/after values.
- Seed grows to include all the above with the exact defaults from spec §5.13/§6 (9 categories, 6 matter types + 4 sub-process templates with 54 stages total, 18 forums, 10 event types, 6 document folders, 7 outcomes, 10 reminder rules).

### Verified
Full click-through against a running server and real database: added, renamed and deactivated a category (with reorder buttons); viewed matter types and drilled into Civil litigation's 11-stage lifecycle; edited a reminder rule's schedule and confirmed the change persisted; loaded every settings tab with zero console/page errors. Confirmed the seed is idempotent — re-running it twice produces the same row counts, no duplicates.

## Phase 2 follow-up — settings table design feedback (2026-09-27)

### Changed
- Settings tabs redesigned as a single horizontal row of underline tabs above the content, instead of a vertical column down the side — frees the width for the table and matches the case-page mockup's tab style. Dropped the outer "Settings" heading, which just repeated what the top bar and each tab's own title already say.
- Every settings table (categories, forums, event/document types, outcomes, matter types, lifecycle stages) now has a single "⋯" action menu per row instead of a row of separate icon buttons — Edit, Move up/down, and Deactivate/Reactivate (in red) all live in one dropdown. Much less clutter, especially on narrower screens.

### Fixed
- Local Mailpit clashed with another project's on ports 1025/8025; moved ours to 1026/8026 in `docker-compose.yml`, `.env(.example)`, the seed script and the README.

## Phase 2 follow-up — top-placed add, real delete (2026-09-27)

### Changed
- "+ Add" now sits above the table on every settings page, instead of below it — no more scrolling past a long list to add something.
- Every settings row's "⋯" menu gets a **Delete** option alongside Deactivate. This is a real, permanent delete (not soft) — safe right now because nothing in the app references these rows yet (matters don't exist until Phase 4). Confirmed with a browser dialog before it runs. Deactivate stays the everyday tool; Delete is for cleaning up a genuine mistake. Once later phases add matters/documents/events that reference these tables, delete must first check nothing uses the row (spec §5.13: "hard delete only if never used") — flagged in code comments at each delete action so it isn't missed.

### Verified
Created a test category, deleted it through the real UI (confirmed the browser dialog, confirmed the row disappeared entirely rather than just greying out) — checked with a live browser session against the running app, not just code review.

## Phase 3 — Users (2026-09-27)

### Added
- `/users`: list every lawyer (and the Admin), invite a new lawyer, edit their details, deactivate/reactivate, resend a pending invite, and force sign-out of all their sessions.
- No schema changes — everything needed was already on `User` from Phase 0.
- Inviting a lawyer reuses the exact same reset-password email as `/forgot-password` (spec §15 decision) — no separate invite mechanism to maintain.
- Status is computed, not stored: **Invited** (account exists, never activated) vs **Active** (has signed in and set a password) vs **Deactivated**.
- Practising certificate expiry gets a visual badge — amber within 60 days, red once expired — reusing the "Practising certificate expiring" reminder trigger seeded in Phase 2.
- Deactivating a lawyer revokes every session immediately (FLOWS §19); "Sign out all sessions" does the same without deactivating the account (e.g. a lost laptop).
- Users are never hard-deleted (CLAUDE.md) — no Delete option here, deactivate is the only removal path. An Admin can't deactivate their own account.
- Deliberately **not built yet**: "reassign all of a departing lawyer's cases." There's no `Matter` table until Phase 4, so there's nothing to reassign — this arrives as part of Phase 4's deactivation flow instead of being faked now.

### Verified
Full browser click-through against the running app: created a lawyer, confirmed the invite email actually arrived in Mailpit, confirmed the new account shows "Invited" with a cert-expiry warning, edited their title, ran "sign out all sessions", deactivated (with the confirmation dialog) and reactivated, and confirmed the Admin's own account can't be deactivated (button disabled). Zero console/page errors throughout.

## Phase 3 follow-up — slide-over add forms, sidebar quick-add (2026-09-27)

### Changed
- Every "Add" form (categories, forums, event/document types, outcomes, matter types, lifecycle stages, lawyers) now opens as a right-side slide-over panel with a blue header, triggered by a primary blue button in the page's own header — instead of an inline form that pushed the table down. Closes on Escape or clicking outside.
- New shared `src/components/ui/slide-over.tsx` and `src/components/app/add-reference-button.tsx` (the generic version used by the five simple settings tables).
- Removed "+ New case" from the top bar — it only ever made sense on the Cases page, not floating on every screen. It now lives as a real button on the Cases page itself.
- Added a small "+" quick-add icon next to **Cases** and **Users** in the sidebar, so adding one is one click from anywhere, without visiting the list first. Cases' "+" goes straight to the (multi-step, so it gets a full page, not a drawer) New Case wizard; Users' "+" opens the Add lawyer panel directly via `/users?new=1`.

### Verified
Full browser click-through: sidebar "+" opens the Add lawyer panel and creates a real lawyer; Categories' "Add" opens its panel, Escape closes it; the top bar no longer shows "New case" anywhere, and the Cases page has its own. Zero console/page errors.
