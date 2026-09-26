# CLAUDE.md — CAA Legal (UCAA Legal Case & Matter Management)

Read `PROJECT_SPEC.md` and `FLOWS.md` before any work. The spec is the source of truth for scope, roles, data model, security and phases; FLOWS.md defines exactly how each journey behaves. `docs/design/case-page.html` is the visual reference — match its look (spacing, chips, cards, tracker) when building screens.

## How to work in this repo
- Build **one phase at a time** (spec §12). Do not start a later phase unless asked.
- Before coding a phase: list the files you will create/change and the Prisma schema changes, then wait for approval.
- After each phase: run lint, typecheck and tests; update `CHANGELOG.md`; update the seed script.

## Stack
Next.js (App Router) · TypeScript strict · Tailwind · shadcn/ui · lucide-react · Prisma + PostgreSQL · Better Auth (email/password + TOTP 2FA) · zod · Recharts · Docker Compose.

## Environment gotchas hit so far (check before assuming they're fixed)
- **`npm install <pkg>` without a version can resolve to an unstable prerelease** if that's the npm "latest" tag (happened to `prisma` → 8.0.0-rc and `typescript` → 6.0.3, and once to `react`/`react-dom` drifting apart). Always check `npm view <pkg> dist-tags.latest` looks like a real stable release before trusting an unpinned install, and pin the exact version in `package.json`.
- **Next 16 renamed `middleware.ts` to `src/proxy.ts`** (export `proxy`, not `middleware`) and runs it on the Node.js runtime by default — it can call Prisma/Better Auth directly, no Edge workarounds needed.
- **A file/folder starting with `_` under `app/` is a private folder** — Next excludes it from routing entirely (learned the hard way with a temp test route).
- Modules importing `"server-only"` (`src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/mailer.ts`, …) **throw if imported outside a Next.js server context** — a plain `tsx` script (like `prisma/seed.ts`) must not import them; use a separate `PrismaClient` instance and the specific low-level functions it needs instead (see `prisma/seed.ts`).
- Better Auth's `verifyTOTP`/`verifyBackupCode` **rotate the session on first 2FA confirmation** (old token deleted, new one issued). Read `getCurrentUser()` *before* calling them, not after, or you'll read an already-stale session.
- A network connection can go from fine to 10+ minutes per package download and back with no warning — if an install or a Docker pull stalls or resets, that's very likely the network, not the tool.

## Conventions
- Server Actions or route handlers for mutations; **validate every input with zod on the server**.
- **Every mutation checks permissions** via a single helper (`requireRole`, `canAccessMatter(userId, matterId)`) — never trust the client.
- **Every mutation writes an AuditLog row.**
- Never hard-delete users, matters, documents or messages — use `isActive` / soft delete.
- Deadlines and legal time periods are **data, not constants**. No hard-coded day counts.
- Categories, lifecycles, forums, outcomes, reminder rules come from Admin Settings tables — never hard-code them in UI or logic.
- Files: never expose storage URLs; always go through the permission-checked download route; encrypt before storing; log every access.
- Dates stored in UTC, displayed in `Africa/Kampala`. Money stored as integer UGX.
- Components: `components/ui` (shadcn), `components/app` (our composed components). Keep pages thin.

## Design rules
- Use ONLY the tokens in spec §10 (defined once in `globals.css` / Tailwind theme). Warm off-white `#F7F6F3` bg, white cards, warm-grey `#E6E3DD` borders, 16px card radius, 24px padding, barely-there shadow.
- One bold blue `#4169E1` (hover `#3759BF`, soft `#E8EDFC`) used only for primary actions, active nav, links and the current lifecycle stage.
- Status colours: green = on track/won, amber = due soon, red = overdue/critical, grey = closed.
- Input fields are sharp-cornered (`rounded-none`) — cards and buttons keep their rounded corners.
- Login and every account-recovery screen use the split layout in `src/app/(auth)/layout.tsx` (brand panel + white form), not a centred card.
- Every list/page needs empty, loading (skeleton) and error states.
- Font: Inter for UI; Source Serif 4 (600) only for page/case titles (28–30px). Card titles 16px/600, body 14px, meta 12–13px muted. Tabular figures for numbers.
- Light and dark tokens both defined; theme chosen in Profile, not the top bar. Avatar colours come from `--avatar-*` tokens.
- lucide icons only, no emoji. Search hint shows Ctrl K on Windows, ⌘K on Mac.
- Respect `prefers-reduced-motion` (e.g. the current-stage pulse).
- "Later (v2)" = deferred feature; "Phase N" = build phase in spec §12. Don't mix them.

## Domain words
- **Matter** = any piece of legal work; litigation "case" is one matter type.
- **Lead / Supporting lawyer** = assignment roles on a matter.
- **ECCMIS number** = the Uganda Judiciary e-filing reference; stored, not integrated.
- **Stage** = step in a matter's lifecycle template.
- **Category** = subject (what it's about, drives reports). **Matter type** = process (picks the lifecycle). Every matter has both.
- **Sub-process** = application/appeal/execution/costs running inside a matter with its own mini-lifecycle.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
