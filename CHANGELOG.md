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
