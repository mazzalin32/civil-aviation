# Changelog

## Chat code split into shared pieces — step 2 of the chat pass (2026-11-07)

Pure refactor: `chat-hub.tsx` (1,423 lines) and `discussion-tab.tsx` (790) were near-copies of each other, so every fix had to be made twice. Their logic is now shared; the largest chat file is 207 lines. No schema changes and no visual changes.

- **Shared (`src/components/app/chat/`):** `use-case-thread` (message list, live updates, paging that keeps your place, auto-scroll, the one-off notification highlight, pin/delete), `use-message-composer` (textarea, @mention autocomplete, files, linked documents, send), `use-case-chat-stream` (the SSE connection), plus `chat-utils`, `mention-text`, `attachment-chip`, `pending-attachments`, `thread-search-bar`, `thread-notices`. `mention-popover` and `attach-document-dialog` moved here from the case tabs folder.
- **Per-screen views stay separate** because the two screens genuinely look different (flat rows in a split pane vs bubbles in cards): the hub is `chat-hub` (which conversation is open) + `conversation-list`, `hub-header`, `hub-thread`, `hub-message-row`, `hub-composer`, `hub-pinned-drawer`; the tab is `discussion-tab` + `tab-message-bubble`, `tab-composer`, `pinned-banner`.
- **Hooks never return refs** (components own their DOM refs and pass elements in) — returning a ref from a hook makes React's lint rule reject every value the hook returns.
- **Small behaviour differences:** the hub now adds your own message immediately instead of waiting for the live event (same de-duplication the tab already had); one delete-confirmation wording instead of two; a conversation that fails to load now shows "Couldn't load this discussion · Try again" instead of leaving the previous case's messages under the new case's header; the client no longer sends a `mentionedUserIds` list (the server ignored it since step 1).

Verified: DOM snapshots of 8 UI states (hub default / search / pinned drawer / counsel popover / @-autocomplete, tab default / search / @-autocomplete) are identical before and after, element for element; the step-1 browser suite (11 checks) and a new two-user live suite (14 checks: switching conversations, live post / pin / delete between two real sessions, Discussion-tab send and delete, de-duplication) pass.

Found while testing, not changed here: after a message is deleted, the Chat hub's conversation-list preview still shows its text until reload (it only updates on new messages). To be fixed with the unread-count work, which reworks that list. The list preview also uses a 📎 emoji, against the icons-only rule.

## Chat hardening — step 1 of the chat pass (2026-11-07)

Correctness and security fixes to case chat, found in an audit against FLOWS §10. No schema changes.

- **Mentions are validated on the server.** The server now derives mentions from the message text (the client-supplied id list is ignored) and keeps only people who can actually open that chat — the matter's assigned lawyers plus the organisation's active Admins (`getMentionableUsers`). Before, any active user id was accepted, so a crafted request could notify a user in another organisation with this case's title, and mentioning an unassigned lawyer sent them a notification leading to a "forbidden" page. The @-autocomplete in the Chat page and the case Discussion tab uses the same list, so it no longer offers people who can't see the chat.
- **Delete rule matches the spec:** the author for 15 minutes, or an Admin at any time (moderation; still a soft delete with an audit row). Previously the author could delete at any time and any lead/support lawyer could delete anyone's message. The 15 minutes lives in one constant (`MESSAGE_EDIT_WINDOW_MINUTES`).
- **A closed matter's chat is read-only** (FLOWS §10 step 5): posting, pinning and deleting are refused by the server, and both screens replace the composer with a notice and hide the pin/delete buttons.
- **Pagination:** a thread loads the latest 50 messages plus every pinned message, with a "Load earlier messages" button for older history (the reader's place is kept). Deep links from notifications keep loading older pages until the target message is included. Search covers the messages loaded so far.
- **Less duplication:** one loader/serialiser (`src/lib/chat/messages.ts`) now backs the Chat page, the case Discussion tab, the stream payload and the chat server actions — previously four copies. Removed the unused legacy `postMessage` wrapper. Business rules are pure functions in `src/lib/chat/rules.ts` with tests.

Verified live in a real browser against 60 seeded temporary messages (removed afterwards): first page capped at 50, load-earlier fetched the rest and kept the reading position, the mention list excluded unassigned lawyers, no delete button on old messages but one on a fresh one, and a CLOSED matter showed the read-only notice with no composer or delete buttons.

## Real-time notifications + cleaner bell (2026-11-07)

Notifications now arrive live instead of on a 45-second poll, and no longer show raw mention markup.

- **Live push (SSE):** new `GET /api/notifications/stream` streams the signed-in user's own notifications. `notify()` publishes to a per-user in-process bus (`src/lib/notifications/event-bus.ts`, same pattern as the chat bus) right after the row is created and before the email send. The bell prepends the item, bumps the badge, plays a short bell animation (off under `prefers-reduced-motion`) and shows a toast when the panel is closed. Polling stays only as a 2-minute fallback, and the client re-syncs on every automatic reconnect. Streams close after 10 minutes so the browser reconnects and re-checks the session.
- **Bus limitation:** in-process, like chat — it only reaches connections on the same Node process. If notifications are ever published from another process (the unbuilt reminder job runner) or the app runs on several instances, swap the internals of `event-bus.ts` to Postgres LISTEN/NOTIFY (PROJECT_SPEC §4); its two exported functions stay the same.
- **Mention bug:** the bell showed `@[Agnes Nakato](user:cmw68…)` because the chat body was interpolated into the notification text unmodified (and cut at 120 chars first, which could split the token). New `src/lib/mentions.ts` resolves tokens to `@Name` before truncating; `notify()` also cleans every message/subject centrally, so emails and all other callers are covered, and the bell cleans rows saved before this fix.
- **Display:** rows now show a type label and icon (blue = activity, amber = due soon, red = needs attention), the case/contract reference as a chip, a two-line preview, a relative time and an unread dot, grouped Today / Earlier, with empty and error states. `NotificationItem` moved to `src/lib/notifications/item.ts` and gained `reference`. No schema changes.

- **Mentions open the Chat, not the case:** a mention used to link to the case's Discussion tab (`/cases/:id?tab=discussion#msg-…`), which neither opened the Chat page nor scrolled anywhere. It now links to `/chat?caseId=…&msg=…` (`src/lib/notifications/links.ts`); the Chat hub opens that thread, scrolls the message to the centre and tints it for a few seconds. Notifications saved with the old link are rewritten on read. The hub is now keyed on case + message, because navigating `/chat` → `/chat?caseId=…` from the bell previously kept the old thread (selection lives in client state).
- **Lint cleanup:** full `eslint` is now 0 errors (was 3 × `react-hooks/set-state-in-effect`: mention-index reset in `chat-hub.tsx` and `discussion-tab.tsx`, preview reset in `file-preview-modal.tsx` — now reset during render, and the preview fetch ignores stale responses). Removed unused imports/state, and configured a leading `_` as "deliberately unused" so `canUploadDocument`'s kept signature stops warning. One warning remains (`<img>` in the file preview, which loads through the permission-checked download route, so `next/image` doesn't fit).

Verified live in a real browser (signed in as a lawyer, notification created server-side without reloading): the bell updated in ~90 ms, the toast and panel rendered, and no raw token appeared. On the very first request after a dev-server restart the stream route has to compile, which can take several seconds — the bell catches up as soon as it connects.

## 2FA switched from authenticator app to emailed codes (2026-11-02)

The QR-code/authenticator-app (TOTP) setup was reportedly too fiddly for staff, so replaced it with Better Auth's built-in email-OTP method — a 6-digit code emailed at login, nothing to install. Scrapped, not kept alongside TOTP: backup codes, the QR step, and the "scan with Google Authenticator" copy are all gone.

- Setup (`/2fa/setup`): opens already having emailed the first code; enter it to finish. A "Resend code" link (30s cooldown) covers a missed or slow email. No password re-confirmation step — reaching this page already proves who you are, and entering a real code that only your inbox received is the proof the account is set up correctly.
- Login (`/2fa`): same shape — a code is emailed the moment the page loads, enter it to continue, resend available.
- `src/lib/auth.ts`'s `twoFactor()` plugin now configures `otpOptions.sendOTP` (new `sendTwoFactorCodeEmail` in `src/lib/mailer.ts`) instead of just `issuer`; the `qrcode` package is no longer a dependency.
- `REQUIRE_2FA` (still `false` in production) and the `twoFactorEnabled` gate in `authz.ts` are unchanged — this only changes *how* the code reaches the user, not when 2FA is enforced.

Verified live end-to-end against the real Mailpit inbox: set up 2FA on the seeded Admin account (code emailed, entered, confirmed), signed out, signed back in, got challenged at `/2fa`, and got in with the freshly emailed code.

## Voice messages in chat (2026-11-01)

A "record a voice note" mic button in both the case Discussion tab and the Chat Hub composer, next to the existing attach/link-document buttons. Click to start, click again to stop — it records through the browser's `MediaRecorder` API and drops straight into the same attachment pipeline a picked file already goes through (envelope encryption, ClamAV scan, permission-checked download route), so no new storage or permission code was needed. Added WebM/Ogg signature detection to the content-based file-type allow-list (`detectFileType`), since only PDF/Office/text/image signatures were recognised before. Clicking a voice note opens the existing file-preview modal with a real `<audio>` player, which also benefits any other audio attachment, not just recorded ones.

While tracing the chat models for this: the schema's `GroupMessage` model (the department-wide channel decided on 2026-09-30, with its own `voiceNoteUrl`/`attachmentUrl` columns already defined) is entirely unused — no action, route or component anywhere references it. `/chat` ("Chat Hub") is in fact just an aggregated view over the per-case Discussion threads (`MatterMessage`), not the separate org-wide channel the decision log describes. Flagged, not built — a materially bigger feature than voice notes and out of scope for this pass.

Verified live: recorded, sent, and played back a voice note in the case Discussion tab (real browser, fake audio device), confirmed the attachment chip, the preview modal's audio player, and the delete flow all work, then removed the test message.

## Parties editing wired back into the case page (2026-11-01)

Following up on the dead-code finding from the toast audit: added a "Manage parties" button next to the Parties section of the Overview panel (visible to Admin/Lead/Support, matching the existing edit-permission boundary for matter fields), opening a slide-over with the existing `PartiesTab` list — add, edit and remove, unchanged from how it was originally built. The underlying `addParty`/`updateParty`/`removeParty` Server Actions already had correct permission checks and audit logging; they just had no UI calling them. Verified live: added, then removed, a test party and confirmed the toast, the list, and a fresh page load all agreed.

## Toast + loading-state audit (2026-11-01)

Went through every component that calls a Server Action, checking each used the existing `withToast`/`useTransition` or `useActionState`/`SubmitButton` pattern (both already standard across the app from earlier work). Found one real gap: `party-form-dialog.tsx` showed its own inline error but never toasted success or failure — fixed to use `withToast` like every other form.

Also found, while tracing it: the "Add/edit party" dialog this fix lives in is **unreachable** — `PartiesTab`/`PartyFormDialog` aren't imported or rendered anywhere on the case page (parties are shown read-only in the Overview panel per the 2026-10-01 decision to fold them in there, but the add/edit UI was apparently never wired back up after that change). `addParty`/`updateParty` work correctly as Server Actions but nothing in the UI calls them. Left as-is pending a decision on where that UI should live — flagged, not fixed, since it's a feature gap rather than a toast/loader gap.

## Reports module completed — all 9 spec'd report types, plus CSV export (2026-11-01)

Spec §5.10 listed 9 ready-made reports; only 3 existed (Case register, Outcomes, Lawyer workload). Added the remaining 6 as new tabs on `/reports`, all sharing the existing filter bar and time-range filtering:
- **By status / category / court** — three drill-down bar charts; clicking a bar jumps to the Case register pre-filtered to that status/category/court (spec's "click a chart bar to drill into the matching cases"). Cases-by-lawyer was folded into the existing Lawyer workload tab rather than duplicated as a fourth chart.
- **Average duration** — average days to close per category (from closed matters) and average days spent per stage (from `MatterStage.enteredAt`/`exitedAt`, counting only stages a matter has already exited).
- **Financial exposure** — claimed-for-UCAA vs claimed-against-UCAA (split by `ucaaRole`, using `amountClaimed`) plus counter-claims (`amountAgainst`, previously tracked in the schema and seed data but never surfaced anywhere in the UI).
- **Upcoming hearings** — open `CalendarEntry` rows of kind HEARING with a future date, across all matters matching the current filters.
- **Overdue deadlines** — open calendar deadlines and open, undone tasks past their due date, merged into one list since both represent the same kind of miss.
- **Inactive cases** — open/on-hold matters with no activity in the last 30/60/90 days (selectable).

Also added CSV export alongside the existing Excel/PDF, for every tab. The export route was restructured so each tab builds one `{columns, rows}` shape that all three formats (CSV/XLSX/PDF) render from, instead of three separate per-tab branches — the 3 original tabs now go through the same path.

Verified live: logged in as Admin, loaded all 9 tabs and downloaded all 3 export formats for all 9 (27 downloads, all 200 OK with real data) — not just a code read.

## Real video calling in case Discussion (2026-11-01)

A "Start video call" button in both the case Discussion tab and the Chat Hub, backed by LiveKit Cloud — one room per matter, same permission boundary as case chat (assigned lawyers + Admin only, via `requireMatterChatAccess`). Every join is audit-logged.

Two real bugs found and fixed while building this, both would have blocked it outright:
- A sync helper function in a `"use server"` file broke the entire app build (every export in such a file must be async) — removed the unused function rather than work around it.
- The app's own `Permissions-Policy` header explicitly set `camera=(), microphone=()` everywhere, which would have silently blocked camera/mic access for every real browser regardless of what the user clicked "allow" on. Scoped it to `camera=(self), microphone=(self)` — still blocked for any embedding/third-party context, allowed for the app itself.

Verified with two real browser sessions joining the same matter's call simultaneously and exchanging live video — not just a connection test.

## New matters open with an admin welcome message (2026-11-01)

A case's Discussion tab started empty until someone posted. `createMatter` now posts "{Admin} opened this case." in the same transaction as case creation, so the thread always has a first line from the person who opened it.

## Email delivery verified; notify() no longer lies about it (2026-11-01)

Confirmed task-assignment emails were already sending correctly (my own first check hit a different project's local Mailpit instance by mistake — the real one showed both test emails had landed fine). Found a real gap while verifying: `notify()` set `emailedAt` based on intent to send, not on the send actually succeeding, and swallowed any SMTP error silently — a genuine failure would have left no trace anywhere. `emailedAt` now only gets set after `sendNotificationEmail` actually resolves; a failure is logged with the notification id, type and recipient instead of disappearing.

## Document storage fixed for production, real in-app notifications (2026-11-01)

### Fixed
- Document uploads didn't survive on production: storage wrote to the local filesystem, which Vercel's serverless functions can't persist to (read-only outside a per-invocation `/tmp` that isn't shared across instances). `src/lib/documents/storage.ts` now uses Vercel Blob (private access — never a bare public URL) when `BLOB_READ_WRITE_TOKEN` is set, local filesystem otherwise; none of its 6 callers needed to change. Verified with a real upload/download round-trip against both backends.

### Added
- A real notification bell — the icon existed but did nothing. `notify()` was already firing for task/case assignment, document uploads, stage changes and mentions, but only stored raw `payload` JSON, not the human-readable line it was already building for email. Added `message`/`url` columns to `Notification` (small backfilled migration) so the bell can show exactly what the email says. Unread badge, dropdown with per-type icons, click-to-read, mark-all-read. Verified live: assigned a task through the real UI, confirmed it landed on the recipient's own bell with the right message and link, confirmed clicking it marked it read.

## Organisation-scoping sweep, design pass, calendar features, and Reports (2026-10-25)

Finished the "page per page" organisation-scoping sweep promised in the multi-tenancy entry below, then moved on to a full visual cleanup pass and the first real build of a Phase-11 module (Reports).

### Fixed (security)
- Closed real cross-organisation gaps found while sweeping every query path: `deleteCase`/`deleteContract` and several document/note/party mutations skipped the organisation check entirely by calling `requireRole("ADMIN")` instead of the matter/contract-scoped guard; `updateNote`/`deleteNote`/`updateParty`/`removeParty` didn't verify the note/party actually belonged to the matter being edited; `users/actions.ts`'s five mutations (resend invite, update, (de)activate, sign-out, delete) didn't check the target user's organisation; the case-chat SSE stream and attachment-download routes used the unguarded `canAccessMatterChat` directly, letting any Admin read another organisation's case chat and download its files; `/documents`, `/tasks`, and `/calendar` listed data organisation-wide with no scoping at all; reassigning a matter/contract didn't verify the chosen lead/support lawyers belonged to the caller's organisation.
- Added `src/lib/org.ts` (`orgId()`) as the one fail-closed helper every list/filter query now goes through.

### Changed (design)
- Sidebar: grouped into short labelled sections, then (per follow-up) flattened again with wider spacing and no section labels; logo + org name now stack instead of sitting side-by-side (was truncating long names); collapse control is icon-only; fixed a real flexbox bug where a short viewport silently truncated the nav instead of scrolling it, then made that scrollbar invisible-but-functional per request.
- Dashboard, Contracts, and every other page's header: dropped every subtitle under a page title or card title app-wide — `PageHeader` no longer accepts a `description` prop at all, so this can't regress. KPI tiles pared down to label + number only.
- Dashboard and Contracts charts rebuilt as real bar charts (baseline, direct value label) instead of thin 1.5px progress lines, per the dataviz skill's guidance — risk-level breakdown kept as a stacked bar (the correct form for a 3-category part-to-whole split) rather than switched to a donut.
- New Matter wizard and New Contract form: removed the redundant eyebrow/title/description blocks repeated on every step, widened the field grid from 2 to 3 columns, trimmed verbose hint text.
- Contracts list: compacted the 9 stat tiles into one row and moved the breakdown charts below the table so the actual contract list is visible without scrolling.
- Calendar re-skinned onto the app's own design tokens (FullCalendar ships Bootstrap-flavoured defaults) — Google Calendar-style today badge, dot-style month events, filled week/day blocks; fixed a real bug where a long event title was hard-clipped mid-character instead of truncating with an ellipsis.

### Added
- Calendar: a personal entry can now link to a real matter and be assigned to another staff member by an Admin (shows on *their* calendar, not the creator's) — previously free-text only. Found and fixed a visibility leak this introduced (a matter-tagged personal entry would otherwise have broadcast to the whole department). Events are now coloured per kind using existing tokens instead of one blue for four different kinds.
- `/reports` (Admin): the first real build of Phase 11 — Case register, Outcomes, and Lawyer workload, sharing the same filters as the Matters list (date range + field, lawyer, category, status, search). Export to Excel or a branded PDF (CAA logo, confidential footer, generated-by/timestamp). Building this surfaced and fixed a PDFKit bug that crashed the whole dev server (an infinite page-creation loop from drawing the footer outside the page's margin box) and a column-overflow bug now guarded against for every future report.

## Multi-tenancy foundation: Superadmin, Organisation, white-label (2026-10-25)

Back on the phased build after the prototype detour. First step of making the database/backend real rather than demo-shaped: a platform layer above Admin, so organisations (CAA today, others later) can be provisioned and branded without touching code. The capability is real multi-tenancy; in practice CAA remains the only organisation.

### Added
- `Role.SUPERADMIN` — platform-level, belongs to no organisation, manages Organisations and their Admins.
- `Organization` model — name, logo, one accent colour ("just in case they want to change the logo"), `isActive`. `User.organizationId` (nullable — null only for Superadmin), `Matter.organizationId` and `Contract.organizationId` (both required) tag every piece of content to its organisation, foundational for later per-org isolation.
- `/superadmin` — organisation list + create; `/superadmin/[id]` — edit branding, list Admins, invite a new one. Invite reuses the same single-use-link mechanism an Admin already uses to invite a Lawyer (spec §4), one tier up.
- Sidebar and the login split-panel now read logo/name/colour from the signed-in user's organisation (or, pre-login, the one active organisation) instead of hard-coded CAA assets — the "white-label" half of this.
- A data migration created "Uganda Civil Aviation Authority" as organisation #1 and backfilled every existing User/Matter/Contract onto it — nothing lost, applied to local and production.

### Fixed
- Three places that listed "every active user" without excluding Superadmin (Users & Access, and two task-assignee pickers) would have shown the platform account as if it were a lawyer. Excluded there; a fuller per-organisation query sweep is the next phase of this work ("page per page").

## Contracts made fully independent of Legal Matters (2026-10-17)

A contract was accidentally deleted via the Legal Matters list's "Delete" action — a direct consequence of Contracts being built as a Matter subtype. Restructured Contracts to be a genuinely separate data model with full feature parity (documents, team, audit, notifications), so it can never again be touched by a Matter-scoped action.

### Added
- `Contract` — a standalone top-level model (own reference series, e.g. `UCAA/CTR/2026/0001`), replacing the `ContractDetail`/Matter combination. Holds the five tracking statuses, execution status, key dates and a source-document link directly.
- `ContractStage` — the contract lifecycle vocabulary (Not Yet Effective → Active/In Force → … → Closed/Archived), independent of `MatterType`/`StageTemplate` (the old "Contract" matter type is deactivated, not deleted, per CLAUDE.md).
- `ContractAssignment`, `ContractDocument`, `ContractDocumentVersion`, `ContractDocumentAccessLog` — mirror `MatterAssignment`/`Document`/`DocumentVersion`/`DocumentAccessLog` so contracts keep the same encrypted/scanned/versioned document pipeline, team assignment and access logging Matters have, built specifically for Contracts rather than borrowed from them.
- `/contracts/[id]` — a dedicated contract detail page (status editor, lifecycle-stage mover, team card, document upload/download/delete, a danger-zone delete reachable only from within Contracts) — contracts no longer open at `/cases/[id]`.
- `canEditContract`/`requireContractAccess`/`requireContractEdit` in `authz.ts` — the same Admin-or-Lead/Support permission model Matters use, scoped to `ContractAssignment` instead of `MatterAssignment`.
- `Notification.contractId` (nullable, alongside the existing `matterId`) so contract assignment/document notifications link to `/contracts/[id]`.

### Changed
- `/contracts`, `/contracts/new` and the Excel export now read/write the `Contract` model instead of `Matter`-with-`matterType=Contract`.
- A one-time data migration carried both existing contracts (SkyLink, Meridian) and their team assignments from the old `Matter`/`ContractDetail` rows into the new `Contract` table before those old rows were soft-deleted — no data lost, applied to both local and production.

### Removed
- `ContractDetail` model and the Contract-specific UI on the case page (`contract-details-card.tsx`) — a Matter can no longer represent a contract at all.

## Contracts register (2026-10-15)

Client feedback from the prototype demo: a dedicated place to track the organisation's contracts through receipt, legal review, internal approval, Attorney General vetting, amendments and signature — as its own register, not folded into the litigation wizard. Replaces an earlier same-day quick version (a single "Signed Yes/No" field).

### Added
- `ContractDetail` — 1:1 with `Matter` for Contract-type matters: originating department, date of receipt, date submitted for legal review, date of signature/full execution, commencement/expiry dates, outstanding action, and separate CAA/counterparty execution status (Pending/Signed).
- `ContractStatusOption` — Admin-configurable dropdown options (never hard-coded, per CLAUDE.md) backing five parallel tracking statuses: Receipt, Legal Review, Internal Approval, AG Vetting, Amendments. The contract's overall lifecycle (Not Yet Effective → Active/In Force → Suspended → Renewal Under Consideration → Expired/Terminated/Closed) uses the ordinary Matter stage lifecycle instead of a sixth status field.
- **Contracts** nav item: a dashboard + list at `/contracts` (KPI tiles — total registered, under legal review, awaiting approval/AG vetting, requiring amendments, awaiting CAA/counterparty signature, fully executed, active, expiring within 30/60/90 days — plus a sortable table), and a short dedicated intake at `/contracts/new` (title, nature, counterparty, originating department, receipt date, responsible officer, commencement/expiry dates) instead of the 9-step litigation wizard, whose service/court/CAA-position steps don't apply to a contract.
- An "Edit contract details" action on the case page's new Contract details card, permission-checked the same way as every other mutation (`requireMatterEdit`) and audit-logged.
- Two seeded example contracts (one fully executed and active, one awaiting amendments) demonstrating the register end to end.

### Changed
- The Contract matter type's lifecycle stages replaced: Draft/Under Review/Sent for Amendments/Approved/Signed/Rejected → Not Yet Effective/Active-In Force/Suspended/Renewal Under Consideration/Expired/Terminated/Closed-Archived (old stage rows deactivated, never deleted, per CLAUDE.md).
- Contract matters no longer go through the main 9-step New Matter wizard (the matter-type dropdown there now excludes Contract) — they're created via `/contracts/new`.
- The "e.g. XYZ Aviation Ltd v Civil Aviation Authority" placeholder in the matter-title field, and the two illustrative examples in `FLOWS.md`, replaced with a relatable name already used by the seeded demo data.
- Seed data pared down to real matters only: the 15 fictional demo cases removed, replaced by two real, publicly reported CAA matters from ULII judgments (Besigye v. CAA, Makuza v. CAA) alongside the two contract examples — applied to both the local and production (Vercel/Neon) databases.

### Removed
- `Matter.contractSigned` (superseded by `ContractDetail`'s execution-status fields) and the now-unused `seedNileHorizonDetail` demo-content seeding tied to a removed fictional case.

## Contracts dashboard (2026-10-15, same day)

The client shared a richer reference design for the Contracts register. Built a simpler version of it on real, computed data — no fabricated trend percentages or a "Total Contract Value" we don't track.

### Added
- Search + filter bar on `/contracts` (contract type/category, department, lifecycle stage, AG vetting status, internal approval status) — same GET-query-param pattern as the Legal Matters list.
- Three single-hue bar-list breakdowns (Contracts by Type, by Lifecycle Stage, AG Vetting Status) — design-token-compliant (one blue hue for magnitude, per spec §10; no categorical rainbow palette, since the app's tokens don't define one).
- Excel export (`/api/contracts/export`, Admin-only, audit-logged) respecting whatever filters are active, matching the existing Users export pattern.
- Table gained Department, Received date, and Execution columns to match the reference design.

## Spec/flows reconciliation (2026-10-11)

### Changed
- **No code changes.** `PROJECT_SPEC.md` and `FLOWS.md` rewritten to describe what actually shipped since the client approved the pitch-prototype pivot, instead of the original pre-pivot design: org-wide read / assignment-gated edit permission model, the unified shared dashboard, the 9-step intake flow, Overview panel (Parties folded in, not its own tab), the `DEMO_LOGIN_PASSWORD`/`REQUIRE_2FA`/`REQUIRE_PASSWORD_CHANGE` env toggles, the four new org-wide pages (Legal Documents library, External Counsel & Law Firms, Legal Resources & Links, Matter Chat — which supersedes the old "no global Messages page" decision), the 2026-10-08 terminology/nav rename, and the additive schema fields (`LawFirm`, `ResourceLink`, `GroupMessage`, `MatterMessageAttachment`/`Mention`, soft-delete columns, intake fields).
- `PROJECT_SPEC.md` §12 (build phases) now carries an explicit DONE/PARTIAL/NOT BUILT status per phase, verified against the code (not the changelog's narrative) during this pass: Phases 0–7 and 9 done; **Phase 8 (Notifications) partial** — event-triggered notifications work, but nothing sends time-based reminders yet (hearing/deadline offsets, overdue escalation, cert-expiry, digest email — no job runner exists); **Phases 10 (closure workflow), 11 (reports), 12 (case import), 13 (hardening) not built** — their pages are placeholders; Phase 14 (AI) correctly not started.
- `FLOWS.md`'s site map, onboarding, "My Day", case-page, notifications, closure, reports and import flows updated to match, with explicit "not yet built" callouts on flows 12 (reminder sends), 13 (closure), 15 (reports) and 16 (case import) so the flow doc doesn't read as already-shipped.

## Legal terminology pass (2026-10-08)

Applied `correct-terms.docx` — the department's legal-language standard — across the interface.

### Changed
- **Navigation**: Legal Dashboard, Legal Matters, Legal Calendar, Tasks & Legal Deadlines,
  Legal Documents, External Counsel & Law Firms, Legal Resources & Links, Matter Chat,
  Legal Reports & Analytics, Matter Closure Requests, Users & Access, Legal System Settings.
  Sidebar brand reads "CAA Legal Department".
- **Dashboard** wording per §3: Active Legal Matters / Currently Active, Matters Requiring
  Action / Requires Legal Attention, Upcoming Legal Deadlines / Due Within 30 Days,
  High-Risk Legal Matters / High or Urgent Legal Priority, Matters by Procedural Stage /
  Current Matter Portfolio, Matters by Risk Level / Risk Distribution Across Active Matters,
  View Detailed Report. Risk levels spelled out as High / Medium / Low **Risk**.
- **Procedural stages** renamed per §1 and §4, in the seed and in the database: Intake →
  Matter Intake, Filed & served → Filed and Served, Hearing → Hearing Stage, Application
  filed → Application Filed, Notice of dispute → Notice of Dispute, Investigation → Legal
  Investigation, Decision → **Judgment / Ruling**, Draft → **Draft / Pre-Filing**.
- Greeting addresses the person by full name, so the seeded Admin reads "Good morning,
  Head of Legal" rather than "Good morning, Head".
- "Collapse menu" → Collapse Navigation; "Sign out" → Sign Out; "New case" → New Matter.
- §2 terminology hierarchy: "Case" gives way to "Matter" in page titles and headings.

## Toasts, loader, favicon, performance (2026-10-01)

### Added
- **Toasts** (top-right) for every action: success and error messages for creating, updating, deleting, assigning, uploading, inviting, etc. `withToast(action(...), "Saved")` wraps a server action and shows its returned `error` or the success message; `toast.success/error/info` work anywhere. Chat messages and draft autosaves stay silent unless they fail. Replaces the old `window.alert` popups.
- **Loader**: the CAA logo with a thin sweeping line, shown on first load and while signing in until the dashboard is ready (`app/loading.tsx`, login overlay). Respects reduced motion.
- **Favicon / app icons** generated from the logo (`app/favicon.ico`, `icon.png`, `apple-icon.png`).

### Changed (performance)
- The session + user lookup now runs **once per request** (React `cache`) instead of in the proxy, the layout and the page separately; the proxy is a cookie-presence check for pages (full check kept for `/api/*`). Onboarding gates (forced password change, mandatory 2FA) moved to the app layout and the permission helpers (`assertOnboarded`).
- Session expiry now refreshes at most once a minute (`updateAge: 60`) instead of writing to the database on every request.
- Case page loads everything in one parallel batch (was four sequential rounds) and only loads notes, documents, folders, messages and assignable people for the tab that shows them; other tabs use counts.

## Emails and tasks (2026-10-01)

### Changed
- **Email template** redesigned: blue page, white logo badge, white card, blue button (matches the login screen). The CAA logo is attached to every email (inline by CID) so it always displays, independent of `APP_URL`. Plain-text version added for deliverability.
- **Tasks**: Admins can create a task on any case from **Tasks → New task**, and a case Lead can create one on cases they lead; either can assign it to **anyone active in the department** (not just the case team). The assignee gets an in-app notification (`TASK_ASSIGNED`; add/seed the rule to also send email). The case Tasks tab's assignee list is likewise the whole department. The server still requires Admin or the case's Lead to assign.

## UI: searchable dropdowns, row menu, team add (2026-10-01)

### Changed
- **Dropdowns**: any select with more than 7 options now has a search box (keyboard friendly); shorter lists stay native. Drop-in change to the shared `Select`, so every form gets it.
- **Row action menu (⋯)** now renders in a portal with fixed positioning and opens upward near the bottom of the screen, so it is never clipped by a table or covers the section below.
- **Case page → Team card** has an **Add** button for admins (opens the case team dialog).
- Auth screens: the tagline now reads "© 2026 CAA Legal — Case & Matter Management".

## Admin delete, department-wide visibility, branding (2026-10-01)

### Added
- **Delete user** (Admin, Users → row menu). Soft delete per the repo rules: hidden from the list and export, signed out everywhere, password removed, removed from case teams; refused while they lead an open case. Adding the same email again restores the account.
- **Delete case** and **Add people** (Admin, case page). Delete is a soft delete — the case disappears from every list, calendar, task list and dashboard and its page 404s; documents and audit history are kept.
- Schema: `User.deletedAt`, `Matter.deletedAt/deletedById` (migration `20261001150000_soft_delete_users_matters`).

### Changed
- Dashboard, Tasks and Calendar are now department-wide for every account (same view as the Admin); what someone can *do* is still gated per action (Admin or assigned lawyer). Chat stays scoped to the cases a lawyer is assigned to (Admin sees all).
- Links and Law Firms: only Admins see/use the add buttons (enforced on the server too). Documents: anyone can upload; only Admins can delete.
- Case Overview heading "How it came in" is now **Matter intake**; the parties group reads "Parties · CAA is …".
- Branding: "UCAA Legal Department" is now **CAA Legal Department** on the login screens and in labels; auth screens show © 2026 under the form.

## New case intake: 9-step flow (2026-10-01)

### Changed
- **Case Overview** now shows what was captured at onboarding: a plain-language status banner (On track / Due soon / Action needed / On hold / Closure requested / Closed), quick tiles, then "How it came in", parties, service & legal process (with response-deadline countdown), court & forum, and legal representation. The written summary sits below and stays editable.
- **New case** is now a 9-step intake with a progress rail: Matter identification → CAA position & reporting → Service / legal process → Parties → Court & judicial information → Legal representation → Matter stage → Documents → Review & submit. Our design tokens are kept; only the sequence and fields follow the intake mockups.
- The reference is generated on submit (previewed read-only in step 1). Category and matter type are chosen in step 1 because the stage list in step 7 comes from the matter type's lifecycle.
- The response deadline (step 3) and next action due (step 7) become real calendar DEADLINE entries; internal notes become the first case note; the responsible legal officer becomes the lead lawyer and is notified. Cases are created as Open.
- Documents chosen in step 8 are uploaded through the normal encrypted, virus-scanned upload right after the case is created.
- CAA positions extended (Claimant, Petitioner, Interested Party, Appellant, Respondent to Appeal, Other); the cases filter and Key facts use the same labels.
- Drafts saved by the old 5-step wizard are discarded (different shape).

- Seed: sample cases now carry intake fields (description, reported by/method, service direction, process, court station, representation); existing seeded cases are backfilled where those are empty.

### Schema (migration `20261001120000_intake_flow_fields`, additive)
- `Matter`: description, reportedAt/By/Method, serviceDirection, processNature/IssuedAt/ReceivedAt, receivedBy, legalRecipientId, courtStation, filedAt, jurisdiction, representationStatus, externalCounselName/Contact. `Party`: organisation, partyType, roleInMatter. New `ServiceDirection` enum and 6 `UcaaRole` values.

## Fixes: dashboard layout, case Overview, invite emails, migration (2026-10-01)

### Changed
- **Case page**: "Case in 30 seconds" is now **Overview** and opens with a snapshot strip (stage, next deadline, open/overdue tasks, documents, discussion) where every tile links to its tab. The lifecycle tracker shows Completed / In progress / Upcoming per stage, days spent in each, a legend, and "Jump to current stage" / "Open full timeline" links. Stages before the current one now count as completed even without a recorded move.
- **Emails**: shared template redesigned with the CAA logo header, boxed credentials card for the shared-password invite, and escaped names. The logo loads from `APP_URL`, so `APP_URL` must be the real public URL in production.

### Fixed
- **Dashboard** no longer overflows the viewport (`minmax(0,1fr)` grid track, truncating rows, scrollable stage chart).
- **Migration `20260930190000_pitch_prototype_models`** re-created tables that earlier migrations already create, so `prisma migrate deploy` failed on any existing database. It now only adds the chat pinning/soft-delete columns, `MatterMessageAttachment` and `MatterMessageMention`.

## Phase 9: Case discussion (chat) — realtime, @mentions, pinning, attachments (2026-09-30)

### Added
- **Full Case Discussion System**: Per-case collaboration thread scoped to each matter, fully integrated into the Case Page `Discussion` tab.
- **Realtime Delivery via SSE**: Server-Sent Events stream (`/api/cases/[id]/chat/stream`) with automatic reconnection and exponential backoff, broadcasting message creation, pinning, and deletion across active browser tabs with no polling.
- **Dual Attachment Capability**:
  - Direct file uploads (up to 25MB) encrypted with envelope AES-256-GCM and virus-scanned with ClamAV before storage.
  - Case document linking to attach existing case files directly into discussion threads with dedicated search picker dialog.
  - Secure download endpoint (`/api/cases/[id]/chat/attachments/[attachmentId]/download`) supporting confidentiality enforcement, PDF watermarking, and audit logging.
- **@Mentions with Notifications**: Typing `@` triggers interactive autocomplete popover with team members prioritized. Mentioning users triggers in-app and email notifications.
- **Message Pinning & "Case in 30 seconds" Integration**: Lead lawyers and Admins can pin key discussion messages. Pinned messages display in a banner inside the discussion tab and promote to the "Case in 30 seconds" catch-up panel.
- **Thread Search & Filtering**: In-thread search bar filtering messages, authors, and attachment filenames with live match counts.
- **Soft-Deletion & Audit Logging**: Authors and Lead/Admin users can soft-delete messages (`deletedAt`), and every chat mutation (post, pin, unpin, delete) writes to `AuditLog`.
- **Database & Reference Data**: Added `MatterMessageAttachment` and `MatterMessageMention` models to Prisma schema, and updated `prisma/seed.ts` with demo chat messages on the Nile Horizon case.

## Documents page: real upload, sort, sample files (2026-09-30, latest)

### Added
- "Upload document" button on `/documents` — a real upload (encrypted, virus-scanned, same pipeline as a case's Documents tab), just with a Case picker up front since this page isn't scoped to one matter.
- Sort control (Latest first / Name A–Z) on the library.
- Seed now creates 4 real sample documents (encrypted + written to disk, not fake UI rows) across a few cases, so the library shows real file icon + filename + case + folder + size instead of an empty state.

### Fixed
- `uploadDocument`'s validation broke for any form that doesn't render a `linkedEventId` field (like the new global upload dialog, which has no single timeline to link into) — `FormData.get()` returns `null` for a missing field, and zod's `.optional()` only accepts `undefined`, so it failed with "Invalid input" every time. Coalesced `null` to `undefined` before validating.

## Sidebar/dashboard cleanup, logo placement (2026-09-30, later still)

### Changed
- Sidebar nav is one flat list again — dropped the Workspace/Case management/Reporting section headers, matches the "everyone sees it all, no artificial grouping" prototype feel.
- Sidebar brand mark now uses the actual CAA logo image instead of a generic icon.
- Login screen no longer repeats the logo on the white side — it only appears once, on the blue panel.
- Dashboard greeting is just "Good morning/afternoon/evening, {name}" — dropped the descriptive subtitle under it.

### Fixed
- The "Matters by stage" and "Matters by risk" dashboard cards had a too-short fixed height (`h-[180px]`) for their content (count label + bar/donut + caption line), so the content overflowed past the card's top padding — it looked like the first bar's count label was misaligned/overlapping the card subtitle, when every bar was actually at an identical position (confirmed via bounding-box measurement); the real bug was the container being shorter than what it holds, not a per-item offset. Fixed by sizing the container to fit its content properly.

## Pitch prototype: new nav pages, login redesign (2026-09-30, later)

### Added
- **Documents** (`/documents`): org-wide, read-through library across every matter's documents, searchable by name/case, with view/download links back into the case's Documents tab. Uploading still happens from the case page.
- **Law Firms & Counsel** (`/law-firms`): directory of outside firms/counsel — new `LawFirm` model, anyone can add/edit, Admin can deactivate.
- **Links** (`/links`): quick-reference links to statutes/court portals, grouped by category — new `ResourceLink` model.
- **Group Chat** (`/chat`): org-wide chat separate from each case's own discussion thread — new `GroupMessage` model. Call buttons, attach and voice-note are UI-only for this prototype (no calling backend), and say so when clicked rather than doing nothing.
- Seed now adds two sample law firms, three sample links, and one starter group-chat message so these pages aren't empty on a fresh seed.

### Fixed
- Every sidebar link now resolves — previously Documents/Law Firms & Counsel/Links/Group Chat were in the nav but 404'd, and Reports was Admin-only despite being in every role's nav.
- A stale dev server process (holding an old, pre-migration Prisma Client in memory) was serving a generic error page for the new routes; restarting it after `prisma generate` picks up the new models.

## Login redesign to match reference (2026-09-30)

### Changed
- Rebuilt the login screen around the reference the client provided: large circular seal-style badge on the brand panel, "Welcome to CAA Legal / Case & Matter Management" heading with the logo above it on the white side, uppercase primary button, and inputs that only tint on the bottom border when focused (no ring/glow).
- Auth pages now force the light design tokens regardless of the browser/OS's dark-mode preference — there's no signed-in user yet to have picked a theme, and a dark browser was rendering the whole login page dark, which is what looked "not white" before this fix.

## Pitch prototype: org-wide visibility, nav overhaul (2026-09-30)

### Changed
- **Org-wide read access**: any lawyer can now open any case (not just ones they're assigned to) — `canAccessMatter` always allows read. Editing case data (stage, parties, summary, notes, timeline events, closure) is still limited to the case's Lead/Support or Admin, via new `canEditMatter`/`requireMatterEdit`.
- **Document uploads are org-wide**: any lawyer can upload a supporting document to any case regardless of assignment (`canUploadDocument`); deleting still requires Lead/Support/Admin.
- **Task assignment**: only a case's Lead (or Admin) can create/delete/reassign tasks (`canAssignTasks`/`requireTaskAssign`); the task's own assignee can still mark their own task done/reopened even off the case team.
- `/cases` drops the "My cases" (assigned-only) filter for lawyers — everyone sees the full case list, matching the new org-wide model.
- Sidebar rebuilt with grouped sections (Workspace / Case management / Reporting), a live open-tasks badge, and the same nav for every role (Admin gets an extra Administration section). Hearings, Parties, Audit Trail and Import dropped from the nav.
- Login screen: wider brand panel, placeholder-only fields (no visible labels) matching the reference look the client pointed to.

### Fixed
- `proxy.ts`'s route matcher didn't exclude public static files (images, fonts) — an unauthenticated request for the login page's own logo was 307'd to `/login`, breaking the image. Matcher now excludes common static asset extensions.

## Prototype dashboard (2026-09-29)

### Added
- Shared **Dashboard** for Admin and lawyers: greeting, KPI cards, matters-by-stage, matters-by-risk, cases needing attention, and deadlines requiring action. Widgets are clickable (cases, calendar, tasks, reports). Admin sees the whole portfolio; a lawyer sees only assigned matters. **New case** stays Admin-only.
- Per-case **Discussion** chat — the one place lawyers can write as well as view. `MatterMessage` table + audit on every post.
- `/tasks` is a real list (open tasks, overdue highlighted) for both roles, linked from the dashboard.
- Prototype lawyer login: `DEMO_LOGIN_PASSWORD` (currently `12345678`). Invited lawyers get that password by email and can sign in immediately with their email. Seeded lawyers use the same password.

### Changed
- Lawyers land on `/dashboard` (same layout as Admin). `/my-day` redirects there.
- On a case, lawyers are view-only (no add event, move stage, upload, task CRUD, notes, summary edit). Admin still does those actions.
- Case tabs: **Parties** removed; **Hearings & deadlines** is now **Deadlines** only.

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
