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

## Phase 3 follow-up — user detail page, filters, Excel/PDF export, flexible import (2026-09-27)

### Added
- `/users/[id]`: click any row to open a lawyer's detail page — full profile, 2FA/last-login/account-created facts, and their last 25 audit log entries in plain language. Edit, resend invite, sign out sessions, and deactivate/reactivate all work from here too (reuses the existing Phase 3 actions, no new mutation logic).
- Filters on `/users` (status, department, cert expiring within 60 days) live in the URL (`?status=&department=&certExpiring=`), so a filtered view is bookmarkable and drives the export links too.
- Excel and PDF export of the (filtered) user list — `/api/users/export?format=xlsx|pdf` — Admin-only, audited (`user.export`).
- Flexible Excel import: download a template, upload any `.xlsx` with a header row (columns can be renamed/reordered — headers are matched by alias, e.g. "Full Name" or "Lawyer Name" both map to Name), remap any column by hand with instant re-validation (no re-upload needed), preview flags missing/invalid/duplicate/already-registered rows before anything is created, then imports the valid rows and sends each a normal invite email.
- New `ImportBatch` model records every import run (counts, per-row errors) and supports **rollback** within 24 hours — deactivates every account the batch created and revokes their sessions (never a hard delete, per CLAUDE.md). Import history with rollback lives at the bottom of `/users/import`.
- No seed data added for `ImportBatch` — it's a transactional/audit record of a real import run, not reference data an Admin configures.

### Changed
- Add lawyer's form and the Users filter bar were visibly plainer than the rest of the app (flagged from a design reference showing grouped sections with numbered headings, icon-prefixed fields, and consistently sharp inputs). Added `src/components/ui/select.tsx` (a native `<select>` styled to match `Input` exactly — `appearance-none` plus `rounded-none`, since a bare `<select>` renders with the OS's own rounded chrome regardless of Tailwind classes unless appearance is reset) and `src/components/ui/form-section.tsx` (numbered heading + divider, used to group related fields). Add lawyer now groups into "Contact information" / "Professional details" with leading icons on every field; the filter bar and every settings "Add" form's `<select>` picked up the same fix for consistency. Widened the slide-over panel from 560px to 640px to fit two columns comfortably.

### Verified
Full Playwright-driven browser run against the running dev server (temp-installed, not a project dependency): clicked into a user's detail page and confirmed profile + activity log; applied and cleared each filter; downloaded and opened both the Excel and PDF exports; downloaded the import template; built a real test workbook covering a clean row, a missing email, an invalid email, a duplicate-in-file, an already-registered email, and an unreadable date, and confirmed the preview flagged exactly the right rows with the right reasons; confirmed auto column-detection on aliased headers; imported the valid rows and confirmed the invite emails actually arrived in Mailpit; rolled the batch back and confirmed the created accounts were deactivated (not deleted); confirmed a batch outside the 24-hour window can't be rolled back. Along the way, caught and fixed a real counting bug: `confirmImport`'s skipped-row count matched failed rows by email, so a duplicate-email row that shared its email with a row that *was* created got silently excluded from the failure count — switched to matching by row number instead. Deleted all test users/import batches created during this run afterwards; uninstalled Playwright and confirmed `package.json`/`package-lock.json` were unaffected.

## Phase 7 — Calendar, hearings, deadlines, tasks (2026-09-28)

### Added
- `/calendar`: a real Month/Week/Day/Agenda calendar (FullCalendar) — "My calendar" for a lawyer (their own hearings, deadlines, tasks and personal entries), "Department calendar" for the Admin (everyone's, filterable by lawyer). Click any entry for a detail panel (what it's for, an Open case link, Record outcome when it's due). Add a personal entry (leave, training) that only affects availability, not tied to a case.
- **Clash detection**: a banner warns when the same lawyer has two open hearings overlapping in time.
- **Record outcome** (FLOWS §7) — the richest piece of this phase: Proceeded (notes + optional next date), Adjourned (reason + required next date — automatically creates the follow-up hearing and chains it to the original via `nextEntryId`), Ruling/judgment delivered (logs a timeline event and, if a matching Deadline Rule exists, automatically creates a suggested task), Directions given (one task per line, due on a given date or 7 days out by default).
- **Schedule hearing** and **Add deadline** are real now in the case header's ⋯ menu (previously disabled Phase-7 placeholders).
- New **Hearings & deadlines** and **Tasks** tabs on the case page, replacing their Phase-5 placeholders — full task CRUD (complete, reopen, mark not applicable with a reason, delete).
- New **Deadline rules** tab in Admin Settings (reusing the existing reference-table pattern) — when a timeline event of a given type is logged or a matching hearing outcome is recorded, the app suggests a deadline a configured number of days later. Seeded with three illustrative starting points; the Admin is expected to review actual limitation periods for their jurisdiction — nothing legal is hard-coded (CLAUDE.md).
- **Real .ics subscription feed** (`/api/calendar/feed.ics?token=`, the `ics` package) — token-authenticated since calendar apps poll it without a browser session; shows only the case reference and time by default, never confidential details (spec §5.8). The token is lazily generated from a "Subscribe (.ics)" button on the calendar page and copied to the clipboard.
- New models: `CalendarEntry`, `Task`, `DeadlineRule`; `User` gained an `icsToken` column.
- FullCalendar (`@fullcalendar/{core,react,daygrid,timegrid,list,interaction}`) pinned to `6.1.21` across every package — `core`/`react` have a stable `7.x` on their own `latest` tag, but the view plugins (`daygrid`, `timegrid`, etc.) don't yet, so installing "latest" across the board would have silently mixed an incompatible major version into the mix. Same category of trap as the `prisma`/`typescript` prerelease-tag issue noted earlier in this project, just harder to spot since `7.1.0` itself is a real stable release — only the *combination* is broken.

### Fixed
- **Real bug caught during live testing, not by inspection**: both the Record-outcome and Schedule-hearing/Add-deadline dialogs conditionally render different fields depending on a selection (outcome type; hearing vs. deadline), and reading an unrendered field via `formData.get()` returns `null` — which fails the zod schema (expects a string) instantly and silently, before the action does anything. This meant recording any outcome other than the exact fields present, and **every** "Add deadline" (since deadlines don't render the hearing-only court/courtroom fields), failed with no created record — the form just silently closed as if it worked. Never would have surfaced testing only the "happy path" combination (hearing fields, on a hearing). Fixed by coercing every optional field to `""` at the call site before sending.

### Verified
Full Playwright run against the running dev server: the seeded mediation session and tasks render correctly on the calendar and in the case's Hearings/Tasks tabs; opened an entry's detail panel and confirmed the Open case link; added a personal entry and confirmed it renders; generated and fetched the `.ics` feed directly and confirmed it's a real, parseable `VCALENDAR` containing the case reference; scheduled a hearing and a deadline from the case header and confirmed both appear (catching the null-field bug on the deadline path in the process); recorded an Adjourned outcome and confirmed the original entry shows the outcome and a real follow-up entry was created; recorded a Ruling outcome and confirmed — via direct database check, since the UI check itself had a timing flake — that it logged a timeline event and created the Deadline-Rule-suggested task ("Comply with ruling", the rule tied to the "Ruling" event type, correctly distinct from "Notice of appeal due" which is tied to "Judgment / order"); added and completed a task. All test data was removed and the mockup case's two seeded calendar/task items, its seven timeline events, and `lastActivityAt` were confirmed back to their exact original state afterward. Playwright was a temporary install; `package.json`/`package-lock.json` only changed for FullCalendar and `ics`.

## Phase 6 — Secure documents (2026-09-28)

### Added
- Documents tab is real: drag-and-drop upload, folders, tags, per-document confidentiality (inherits the matter's by default), versioning (re-uploading the same file name in the same folder creates the next version — old ones stay downloadable), soft delete with Admin-only restore/permanent-delete, and linking a document as evidence to a timeline event.
- **Real envelope encryption** (`src/lib/documents/encryption.ts`): every file gets its own random AES-256-GCM key, which is itself encrypted by a server master key (`DOCUMENT_MASTER_KEY`, generated and kept outside the database) before being stored — a stolen database row alone is useless. SHA-256 of the plaintext is stored per version to prove a file wasn't altered.
- **Real virus scanning** (`src/lib/documents/virus-scan.ts`): a hand-rolled clamd INSTREAM TCP client, no scanning library dependency. Fails closed — if the scanner is unreachable, the upload is rejected, never silently accepted. Verified against a real ClamAV container with the actual industry-standard EICAR test file, which was correctly detected and blocked (`stream: Eicar-Test-Signature FOUND`) and logged.
- **File type verified by content, not extension** (`src/lib/documents/file-signatures.ts`): checks magic bytes for PDF/PNG/JPEG/Office-zip/plain-text; anything else (e.g. an executable renamed to `.pdf`) is rejected before it ever reaches storage or the scanner.
- **Real PDF watermarking** (`src/lib/documents/watermark.ts`, via `pdf-lib`): every view/download stamps "name · date/time" onto each page at request time, computed fresh for whoever is looking right now — not baked in at upload time.
- Every view/download/print streams through `/api/documents/[versionId]`, which re-checks matter access and confidentiality on every single request (no cached permission, no direct storage URL ever handed out) and writes both an audit-log entry and a `DocumentAccessLog` row. **Highly confidential** documents are view-only for non-Admins — no download link is even rendered, and the route enforces it server-side regardless.
- New models: `Document`, `DocumentVersion`, `DocumentAccessLog`, `EventDocument` (links a document to a timeline event as evidence — spec says this blocks deletion without Admin, enforced in `deleteDocument`).
- Storage is local, encrypted filesystem for now (`src/lib/documents/storage.ts`, `DOCUMENT_STORAGE_DIR`) behind a two-function adapter (`putObject`/`getObject`/`deleteObject`) — see "Changed" below for why, and it's the only file a real S3-compatible swap would touch.
- `REQUIRE_VIRUS_SCAN` env toggle added, following the same pattern as Phase 1's `REQUIRE_2FA` — must be `true` before go-live; `false` is a documented dev-only bypass for environments with no clamd running, and the reason is always recorded in `DocumentVersion.scanDetail`, never silently swallowed.

### Changed
- **Object storage**: the plan was S3-compatible storage (MinIO) from the start (`docker-compose.yml` already had the service scaffolded). Tonight, MinIO's Docker Hub image turned out to require a paid login (a licensing change, not a config error), and pulling the open alternative, SeaweedFS, didn't complete in this environment either — both are network/registry issues, not code problems. Shipped Phase 6 on encrypted local filesystem storage instead so upload/download/encryption/scanning/versioning all work today; swapping in real object storage later is a rewrite of one file (`src/lib/documents/storage.ts`), not a redesign.
- Activity tab's audit-entity list extended to include `Document`, and its label map now covers every document action (upload, new version, delete, restore, permanent delete, blocked-infected-upload, view, download, print).

### Fixed
- **Real bug caught during live testing, not by inspection**: clamd's INSTREAM protocol reply is NUL-terminated, and that raw `\0` byte was being passed straight into `writeAudit`'s JSON payload — Postgres's `jsonb` column rejects an embedded NUL outright (`22P05: unsupported Unicode escape sequence`), which crashed the *entire upload* the moment a real infected file was scanned. Never would have shown up testing with clean files only. Fixed by stripping NUL bytes from the clamd response before it touches anything downstream.

### Verified
Full Playwright run against the running dev server, with a real ClamAV container (`docker compose --profile scan up -d clamav`) and `REQUIRE_VIRUS_SCAN=true` — not the dev bypass: uploaded a real PDF and confirmed it's listed; fetched the view and download routes directly and confirmed the returned bytes are a valid, larger (watermarked) PDF; re-uploaded the same file name and confirmed a new version; uploaded the actual EICAR test string (passed as an in-memory buffer in the test — writing it to disk got it quarantined by the host's own antivirus within milliseconds, which is itself a nice confirmation that EICAR detection is taken seriously at every layer) and confirmed the real scanner flagged it, the upload was rejected, and the block was logged; uploaded a Highly Confidential document and confirmed the UI renders no download link for it at all; soft-deleted a document and confirmed it appears in the Admin-only "Deleted" section; confirmed the Activity tab shows every one of these document actions. Along the way, caught and fixed the NUL-byte crash above — the isolated repro (bypassing my own combined test script) was what actually surfaced it. Test documents, their storage files, and the matter's `lastActivityAt` were reset back to the seeded demo state afterward. Playwright was a temporary install; `package.json`/`package-lock.json` only changed for `pdf-lib`.

## Phase 5 — Case page (2026-09-28)

### Added
- `/cases/[id]`: the full case page — header (chips, team avatars, Add event / Move stage / ⋯ menu), a horizontal lifecycle tracker (click any stage to see its dates and events), the "Case in 30 seconds" panel (versioned summary, Key facts, Team — Deadlines card present but empty until Phase 7's calendar), and an 8-tab strip matching the mockup.
- Three new models: `Event` (the timeline), `SummaryVersion` (summary edits keep every previous version, never overwritten), `Note` (shared or private — private notes are filtered out in the query itself for anyone but the author or an Admin, not just hidden in the UI). `MatterStage` gained a `fields` JSON column to hold a stage's `requiredFields` answers when moving into it.
- **Timeline** tab: every event, filterable by type. **Parties** tab: full CRUD on the parties captured during the wizard. **Notes** tab: add/edit/delete, private notes restricted at the query level. **Activity** tab (a small bonus beyond this phase's one-line scope, since it reuses AuditLog and the label-map pattern already built for Users): lawyers see what happened; Admins additionally see the raw before/after audit detail.
- **Move stage**: pick any stage (skip forward freely; moving backward requires a reason), collects a target stage's required fields if it has any, closes the previous `MatterStage` row and opens a new one, logs a timeline event, and — like every mutation this phase — writes an audit entry and bumps `lastActivityAt`.
- **Reassign** and **Put on hold / Resume** built now in the ⋯ menu, since both only needed models that already existed (`MatterAssignment`, `Matter.status`). **Schedule hearing**, **Add deadline**, **New application** and **Request closure** appear in the same menu but disabled with a "Phase N" label — visible so the menu matches the mockup, but nothing pretending to work.
- `requireMatterAccess()` added to `authz.ts` — the case-page equivalent of `requireRole()`, used by the page and every action in it.
- Case list rows are finally clickable, now that there's a real page to send them to.
- Seed: the mockup case (`docs/design/case-page.html`) gets its real summary, 7-event timeline and pinned-equivalent note, matched to the actual mockup content — matched by an idempotency check (skips if the case already has events) so re-seeding never duplicates them, and reachable even when the matter itself already existed from an earlier seed run.

### Verified
Full Playwright run against the running dev server: opened the mockup case from the list, expanded a completed stage to see its logged events, added a timeline event, edited the summary (confirmed a new version, not an overwrite), moved the stage forward with a note (tracker, timeline and "days in stage" all updated), added a party and a private note, opened the Activity tab and confirmed the admin-only before/after detail renders, confirmed every unbuilt tab shows its correct "Phase N" placeholder, reassigned the lead (old lead correctly dropped from the team, timeline logged it), and put the case on hold then resumed it. Because this exercised the *actual* seeded mockup case rather than disposable test data, restored it back to its exact original state afterward (summary, stage, team, timeline, party) and re-ran the seed to confirm it reproduces cleanly. Caught and fixed one mistake in that restore step itself — recreating the opposing party without checking it was already there, leaving a duplicate — before considering the case clean. Playwright uninstalled, `package.json`/`package-lock.json` unaffected.

## Phase 4 — Cases core (2026-09-27)

### Added
- New Prisma models: `Matter`, `MatterAssignment`, `MatterStage`, `Party`, `WizardDraft`, plus the enums spec §7 calls for (`UcaaRole`, `Priority`, `Confidentiality`, `MatterStatus`, `AssignmentRole`, `PartyKind`). Money (`amountClaimed`/`amountAgainst`) uses `BigInt`, not `Int` — CLAUDE.md says "integer UGX" but doesn't fix a width, and a national claim can run past Postgres's 32-bit `Int` range. Deliberately not built yet: `SubProcess`, timeline `Event`, `CalendarEntry`/`Task`, documents, discussion, closure request, notifications, saved views — all later phases, so nothing here is a stand-in for them.
- `/cases/new`: the 5-step wizard (Basics → Forum → Parties → Facts & value → Assign & start) as its own full page, autosaving a per-Admin draft (`WizardDraft`) 700ms after every change. Forum step is skippable for advisory matters. Duplicate check on court case number or opposing-party name warns before creating, with an explicit "Create anyway" to proceed. Creating a case is one transaction: allocates the reference (`UCAA/<prefix>/<year>/<number>`, `src/lib/reference.ts`, atomic per prefix+year via `ReferenceCounter`), creates the Matter, its opening `MatterStage`, the lead/support `MatterAssignment` rows, and any `Party` rows, then clears the draft.
- `/cases`: full case list — sort by title, priority, value or last activity; filter by status, stage, category, matter type, forum, lawyer, priority, UCAA role and value range; time filter (today/week/month/quarter/year/custom) against opened, closed or last-activity date, anchored to Kampala calendar days (`src/lib/date-range.ts`). Search matches title, reference, court number, ECCMIS number and party names. A lawyer's `/cases` ("My cases") is silently scoped to matters they lead or support; the lawyer filter dropdown itself is hidden for them since it could never show anyone else's cases anyway.
- `canAccessMatter(userId, role, matterId)` added to `src/lib/authz.ts` — Admin sees everything, a lawyer only what they're assigned to. Not called anywhere yet (nothing reads a single matter directly until Phase 5's case page), but the earlier work landing this phase needed the shape agreed now rather than guessed at later.
- Seed grows to 15 realistic cases spread across every matter type, lawyer and a few statuses (11 open, 1 on hold, 3 closed), including the exact mockup case (`docs/design/case-page.html`) — UCAA v. Nile Horizon Aviation Ltd, UGX 1.84bn, Mediation stage, Agnes Nakato leading with Brian and Carol supporting. Seeded cases are matched by their (fixed, deterministic) reference on re-run, so reseeding never duplicates them; the shared `ReferenceCounter` is advanced past every number the seed used — but never moved backwards, in case a real case was created between seed runs — so the wizard's next real case this year can't collide with a seeded one.

### Changed
- Not yet built, called out on the Assign & start step itself rather than silently omitted: first deadline/hearing and initial documents (both need models that don't exist until Phases 6–7), and notifying assigned lawyers (Notification doesn't exist until Phase 8) — the assignment itself is still fully real and audited.
- Sorting by priority needed severity order (LOW < MEDIUM < HIGH < URGENT), not the enum's alphabetical string order — fetched in a stable DB order and re-sorted in JS by an explicit rank map instead.

### Verified
Full Playwright run against the running dev server: the 15-case list loads with correct data; search, every filter, sort-by-priority and the "this year" time filter each narrow the list correctly; ran the wizard end-to-end (all 5 steps, a matter type choice correctly populating that type's stages, lead workload counts, support-lawyer checkboxes) and confirmed the created case appears in the list with the right reference, stage, value and team; triggered the duplicate-court-number warning on a second submission and confirmed "Create anyway" and "Cancel" both behave, then discarded that draft and confirmed it's gone. Test case and its draft deleted afterwards; Playwright uninstalled, `package.json`/`package-lock.json` unaffected.
