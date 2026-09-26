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
- Auth tables (sessions, credentials, invite/reset tokens, 2FA, backup codes) come in Phase 1. Better Auth generates them, so they match its format.
