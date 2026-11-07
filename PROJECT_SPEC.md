# CAA Legal — Case & Matter Management System
**Client:** Uganda Civil Aviation Authority (UCAA) — Legal Department
**Document owner:** You (lead designer/developer) · **Build tool:** Claude Code
**Status:** v1.3 — client approved the pitch prototype as the v1 baseline; spec/flows reconciled to match it, build-phase status tracked in §12 (see §15 for the full decisions log). Companion files: `FLOWS.md` (every user flow, step by step) · `docs/design/case-page.html` (reference mockup of the case page)

> **Naming:** "Later (v2)" marks features deferred beyond the v1 build. It is **not** the same as build Phase 2 in §12.

---

## 1. What we are building (one paragraph)

A private, internal web system where the Head of Legal (Admin) creates lawyer accounts, opens cases, and assigns them. Lawyers log in and see only their cases. Every case has its own page that shows the **whole story at a glance**: a visual lifecycle diagram of where the case is, a plain-language summary, the full timeline of events, all documents, upcoming deadlines and hearing dates, the parties and opposing counsel, and a discussion thread. The core promise to a lawyer: **"Open any case and within 30 seconds you remember everything about it."**

## 2. Why this matters for UCAA specifically

UCAA is a regulator *and* an operator (it runs Entebbe International Airport and upcountry aerodromes), so its legal department handles more than court cases. The system should support **"matters"**, of which litigation is one type:

| Matter type | Typical UCAA examples |
|---|---|
| Litigation (as plaintiff) | Recovery of unpaid aeronautical/landing/parking charges, trespass on airport land, breach of contract by a concessionaire |
| Litigation (as defendant) | Employment claims, compensation claims, contractor disputes, judicial review of licensing/regulatory decisions |
| Regulatory enforcement | Action against operators breaching civil aviation regulations, licence suspension/revocation, prosecutions |
| Employment | Disciplinary appeals, Industrial Court claims |
| Procurement disputes | Bidder complaints and applications before the PPDA Appeals Tribunal |
| Land | Airport land boundary disputes, encroachment, compensation for acquisition |
| Arbitration / ADR | Contract disputes referred to arbitration or mediation |
| Advisory (non-contentious) | Legal opinions, contract drafting/review, MoUs, board papers, regulation drafting |

> **Build tip:** Build the data model for "Matter" with a `type` field from day one, even if v1 UI only focuses on litigation. Adding advisory work later is then trivial.

**Contracts are not a Matter type.** The Contracts register (tracking a contract from receipt through legal review, internal approval, Attorney General vetting, amendments and signature to its operational lifecycle) lives as its own standalone module at `/contracts`, deliberately independent of Legal Matters — see §15, 2026-10-17.

## 3. Uganda legal context the system must respect

*I'm not a lawyer — treat this section as a checklist to verify with UCAA's Head of Legal, not as legal advice. Deadlines especially must be configurable, never hard-coded.*

**Court & forum hierarchy (for the "Court/Forum" dropdown):**
Supreme Court → Court of Appeal / Constitutional Court → High Court (Civil, Commercial, Land, Family, Criminal, Anti-Corruption, International Crimes divisions + circuits) → Chief Magistrate's Court → Magistrate Grade I. Plus: Industrial Court, Tax Appeals Tribunal, PPDA Appeals Tribunal, arbitration (e.g. CADER / ad hoc), internal UCAA disciplinary panels.

**Procedure concepts the lifecycle should model (civil litigation):**
- **Statutory notice of intention to sue** — suits against government and certain public bodies generally require a prior notice period (commonly cited as 45 days). Verify with the client whether it applies to UCAA and track it both ways.
- **Summons & service** — summons must be served within a set time of issue; the defendant then has a set time to file a defence. Missed service can lead to the summons expiring.
- **Mandatory court-annexed mediation** in many civil suits before trial.
- **Scheduling conference** → **hearing** → **written submissions** → **judgment/ruling**.
- **Appeals** — a notice of appeal has a short strict window after judgment. This is the single most important deadline to never miss.
- **Execution** of decrees, taxation of costs (bill of costs).
- **Interlocutory applications** (injunctions, extensions of time, etc.) run as sub-processes inside a main case.

**Link to the Judiciary's ECCMIS:** Uganda's courts use ECCMIS for e-filing (see image 1). Our system does **not** replace it. Each court case stores its **ECCMIS case number** and a link, so lawyers file in ECCMIS and record the result here.

**Data protection:** UCAA will be holding personal data (employees, litigants). The Data Protection and Privacy Act, 2019 applies — access control, audit logs, data minimisation and strong document security (§9) are built in, and UCAA's data protection officer should review before go-live.

**Hosting:** the client has no fixed hosting requirement, so the system is built **hosting-agnostic** — it runs the same on a cloud VM, UCAA's own servers or government infrastructure (Docker, S3-compatible storage, standard PostgreSQL).

## 4. Users & roles

| Role | Who at UCAA | Can do |
|---|---|---|
| **Superadmin** *(platform, added 2026-10-25)* | Not CAA staff — the vendor/platform owner | Creates and brands organisations, invites their first Admin. Belongs to no organisation itself and never sees any organisation's matters/contracts/users. CAA is the only organisation that exists today, but the platform is built to host more. |
| **Admin (Supervisor)** | Director Legal / Head of Legal | Everything within their own organisation: create/deactivate users, create cases, assign/reassign lawyers, view all cases, approve case closure, import data, run reports, and **configure the whole system** from the Admin Settings portal (§5.13) |
| **Lawyer** | Legal officers / counsel | Read every matter in the department (revised 2026-09-29, see §15); edit (stage, parties, summary, notes, closure) only matters they lead or support; upload documents to any matter; chat only in matters they're assigned to; write notes |
| *(Later, v2)* **Registry Clerk** | Legal assistant | Log incoming documents/court papers, schedule dates, no strategy notes |
| *(Later, v2)* **Viewer** | DG / management | Read-only dashboards and case summaries |

**Rules:**
- **Configuration principle:** the system ships with sensible defaults (categories, stages, courts, deadline rules, reminders), and the Admin can add, rename, reorder, deactivate or change any of them in the portal. Nothing legal is hard-coded.
- A case has one **Lead Lawyer** and zero or more **Supporting Lawyers**.
- **Org-wide read, assignment-gated edit (revised 2026-09-29, client-approved pitch-prototype pivot — see §15):** any signed-in lawyer can open and read any matter, not just ones they're assigned to — the department works as one pool, and this also makes it trivial to cover for an absent colleague. Editing case data (stage, parties, summary, notes, closure) is restricted to the matter's Lead/Support or Admin (`canEditMatter`). Any lawyer can upload a supporting document to any matter. Only a matter's Lead (or Admin) can assign tasks on it. **The case Discussion thread is the one exception that stays strictly scoped** — only assigned lawyers + Admin can read or post in a matter's chat, same as the original spec.
- **Private notes** on a case are visible only to their author + Admin.
- Every action is written to an **audit log** (who, what, when). Legal work demands this.
- No public sign-up. Accounts are created by Admin only. The real path: a new lawyer gets a **single-use invite link (valid 72 h)** to set their own password and 2FA — the Admin never knows or sends a password. Only the first seeded Admin uses a temporary password, which must be changed at first login. 2FA via authenticator app (TOTP) with backup codes. **Prototype/demo mode (env-gated, must be off before go-live):** `DEMO_LOGIN_PASSWORD` lets every seeded/invited lawyer sign in immediately with one shared password instead of activating their own link — useful for client demos, bypassed entirely when the var is unset. `REQUIRE_2FA` and `REQUIRE_PASSWORD_CHANGE` are separate env toggles (default `true`) that let 2FA/forced-change be switched off for local testing; both must be `true` in production.

## 5. Core modules (v1 scope)

### 5.1 Authentication
Login, invite-link activation, forgot password (email reset link), forced password change (seeded Admin's first login / password expiry), 2FA, session timeout after inactivity, account lockout after repeated failed attempts. The login screen is the first impression: a split layout (revised 2026-09-26) — a solid brand-blue panel on one side with the UCAA identity, plain white on the other with the form. Collapses to a single column on phones. Same tokens as the app (§10), no imagery or clutter.

### 5.2 Admin Dashboard
- KPI cards: Open cases · Hearings this week · Overdue deadlines · Cases closed this quarter
- **Workload per lawyer** (bar list: name, open cases, next deadline) — helps fair assignment
- Upcoming hearings (next 14 days) across the department
- Cases with no activity in 30+ days ("going cold") — very useful to a supervisor
- Recent activity feed
- Quick action: **+ New Case**

### 5.3 Dashboard ("Legal Dashboard" for Admin, same page for lawyers — revised 2026-09-29)
One shared dashboard component for both roles, not two separate designs: greeting, KPI cards (Active Legal Matters, Matters Requiring Action, Upcoming Legal Deadlines, High-Risk Legal Matters), Matters by Procedural Stage, Matters by Risk Level, cases needing attention, deadlines requiring action, recent activity. **Admin sees the whole portfolio; a lawyer sees the same widgets scoped to matters they lead or support** (not the org-wide read that applies to the case list/page — the dashboard stays "my work" by design). Every widget links to the matching list/calendar/report. "My Day"-specific items (today/this week agenda, "Record outcome" cards) live in this same dashboard rather than a separate page; `/my-day` redirects here.

### 5.4 User Management (Admin)
Create lawyer (name, email, phone, title, practising certificate no. + expiry, department). Deactivate (never hard-delete — keeps history, revokes sessions). Delete (Admin, soft delete — hidden from lists/export, refused while leading an open case; re-inviting the same email restores the account). Reassign all of a departing lawyer's cases in one action.

### 5.5 Case/Matter creation (Admin) — 9-step intake, draft auto-saved (revised 2026-10-01 from the original 5-step wizard, per client intake-flow mockups; field coverage below, not original)
1. **Matter identification:** title, reference (previewed read-only, generated on submit), category + sub-category, matter type (picks the lifecycle)
2. **CAA position & reporting:** UCAA's role (now Claimant / Defendant / Petitioner / Interested Party / Appellant / Respondent to Appeal / Applicant / Respondent / Advisor / Other), priority, confidentiality, how it was reported to Legal (description, reported-by, reported method)
3. **Service / legal process:** service direction (served on UCAA / served by UCAA), process nature, issued/received dates, received-by, response-deadline countdown (becomes a real calendar deadline)
4. **Parties:** opposing parties, opposing counsel, witnesses, internal UCAA contact, party organisation/type/role fields
5. **Court & judicial information:** court/tribunal, division, court station, location, court case number, ECCMIS number, judge/registrar, filed date, jurisdiction (skippable for advisory matters)
6. **Legal representation:** representation status, external counsel name/contact (in-house vs. instructing an external firm)
7. **Matter stage:** starting stage from the chosen matter type's lifecycle, first deadline/hearing (next-action-due becomes a real calendar deadline)
8. **Documents:** initial documents, uploaded through the normal encrypted/scanned pipeline right after the matter is created
9. **Review & submit:** full read-back before creating

The responsible legal officer named in intake becomes the lead lawyer and is notified; internal notes become the matter's first note. Cases are created Open. Duplicate check (same court number or same opposing party) still warns before creating.

### 5.6 Case List
Table view + card view. **Sort** by any column (opened date, next date, last activity, priority, value, title). **Filter** by status, stage, category, type, court, lawyer, priority, UCAA role, value range. **Time filters:** Today · This week · This month · This quarter · This year · Custom range — applied to a chosen date field (opened, closed, next hearing, last activity). Search across title, case number, ECCMIS number, parties. Saved filter views; export the current filtered list to Excel/PDF.

### 5.7 The Case Page — the heart of the product

Layout (desktop), top to bottom:

**A. Header:** Case title, reference, court case number, ECCMIS no., court, status chip, priority chip, confidentiality lock chip, team avatars (lead first), action buttons: **Add event · Upload · Move stage** (primary) · **⋯ menu** (Schedule hearing, Add deadline, New application, Reassign *(Admin)*, Put on hold, Request closure).

**B. Lifecycle diagram** — horizontal stage tracker (see §6). Shows template name + category, "Stage X of Y · N days open". Completed stages filled with a check, current stage ringed and pulsing softly (off under reduced-motion), future stages outlined and numbered. Click a stage to see what happened in it (dates, events). Sub-processes (e.g. an injunction application) show as small branches under the main line.

**C. Overview panel** (the memory feature, renamed from "Case in 30 seconds" — revised 2026-10-01) — a snapshot strip (stage, next deadline, open/overdue tasks, documents, discussion — every tile links to its tab), a plain-language status banner (On track / Due soon / Action needed / On hold / Closure requested / Closed), then what intake captured: "How it came in" (now **Matter intake**), parties ("Parties · CAA is …"), service & legal process (with the response-deadline countdown), court & forum, legal representation. Below that, two columns:
- *Left:* **Summary** — three short paragraphs: *What it's about · Where it stands · What's next*. Written/edited by the lawyer (previous versions kept); "Edited by X · when" chip. Pinned discussion messages appear under it. The ✨ AI button only appears when the Admin has enabled AI (Later, v2).
- *Right column:* **Key facts** card (next date & purpose highlighted, amount at stake, UCAA role, judge, opposing counsel, category, last activity) · **Deadlines** card (open deadlines with days-left chips, time spent in the current stage) · **Team** card (lead/support, with an Admin-only **Add** button).

**D. Tabs (revised 2026-09-29/2026-10-01 — Parties folded into the Overview panel above rather than kept as its own tab; "Hearings & Deadlines" shortened to "Deadlines"; Documents tab labelled "Legal Documents" per the terminology pass):**
1. **Timeline** — every event in order: filings, hearings, adjournments (with reason), rulings, correspondence, stage changes, assignment changes. Each event: date, type icon, short description, linked documents, who logged it. Filterable by type.
2. **Legal Documents** — grouped by folder (Pleadings, Evidence, Correspondence, Court Orders, Submissions, Internal Memos). Version history, preview (PDF/images), uploaded-by, date, tags. Drag-and-drop upload; any lawyer can upload, only Admin/Lead/Support can delete.
3. **Deadlines** — calendar + list. Each hearing records outcome afterwards (adjourned to X / proceeded / ruling delivered). Deadlines have a reminder schedule.
4. **Tasks** — checklist items with assignee and due date ("Draft witness statement", "Serve summons"); assignable to anyone active in the department by the matter's Lead or Admin.
5. **Discussion** — chat thread for this case only; @mentions; attach documents from the case; pin important messages. Stays strictly assignee+Admin scoped even though the rest of the page is org-wide-readable (§4).
6. **Notes** — shared notes + private notes.
7. **Activity** — who did what on this case, including document views. Everyone sees case activity; Admin additionally sees the full audit detail (before/after values, IP).

Parties & Contacts CRUD still exists (opposing parties, counsel, witnesses, internal contact) — reached from the Overview panel's parties group, not a separate tab.

### 5.8 Calendar (every lawyer has their own)
- **My Calendar (lawyer):** every hearing, deadline, task and mediation session from the lawyer's cases, generated automatically from the case data — the lawyer never re-enters a date.
- **Department Calendar (Admin):** everyone's dates, colour-coded by lawyer, filterable by lawyer / court / category.
- Views: Month · Week · Day · Agenda (list). Today button, mini-calendar, "jump to date".
- **Each calendar entry says what the date holds:** case title, type (Hearing / Deadline / Mention / Mediation / Judgment delivery / Task), court & courtroom, purpose ("Hearing of injunction application"), what to prepare (linked tasks + documents), and a one-click "Open case".
- Colour & icons: hearing = blue, deadline = amber (red when ≤ 24 h or overdue), task = grey, judgment delivery = blue with a gavel icon — only the tokens in §10.
- **Clash detection:** warn when a lawyer has two hearings at the same time in different courts.
- After a hearing date passes, the entry shows **"Record outcome"** until the lawyer logs what happened (see FLOWS.md §7).
- Personal entries (leave, training) so the Admin sees availability before assigning.
- Export/subscribe via .ics to Outlook/Google/phone calendars (entries contain only the case reference and date by default, not confidential details — configurable).

### 5.9 Notifications
In-app bell + email (SMS optional, later). Admin configures the reminder schedule per event type; defaults below.

| Trigger | Who gets it |
|---|---|
| Case assigned / reassigned to you | Lawyer |
| Hearing in 7 days, 1 day, morning of | Assigned lawyers |
| Deadline in 7, 3, 1 days + overdue | Assigned lawyers + Admin on overdue |
| Hearing passed with no outcome recorded (next morning) | Lead lawyer, then Admin after 3 days |
| New message / @mention in a case | Participants / mentioned user |
| Document uploaded to your case | Assigned lawyers |
| Stage changed / closure requested / closure approved | Assigned lawyers + Admin |
| Case inactive 30 days (configurable) | Lead lawyer + Admin |
| Practising certificate expiring | Lawyer + Admin |
| Suspicious activity (mass download, many failed logins) | Admin |

Users can mute non-critical types; deadline, hearing and security alerts cannot be muted. Daily 7:00 AM **digest email** ("Your day") optional per user.

### 5.10 Reports & Analytics (Admin)
- Ready-made reports: Case register · Cases by status / category / court / lawyer · Outcomes (won / lost / settled / withdrawn / dismissed) · Average duration per category and per stage · Financial exposure (claims for & against UCAA) · Lawyer workload · Upcoming hearings · Overdue deadlines · Inactive cases.
- Every report supports **sorting, filtering (same filters as the case list) and time filtering** (preset ranges + custom range, and choice of date field).
- Charts + table under each chart; click a chart bar to drill into the matching cases.
- Export: Excel, CSV, PDF (PDF branded, with "Confidential" footer, generated-by and timestamp).
- Scheduled reports: e.g. monthly case register emailed to the Head of Legal.

### 5.11 Global search
One search bar (⌘K) across cases, parties, documents (by name, tags and extracted text), and messages — results respect permissions.

### 5.12 Import (Admin)
UCAA almost certainly has existing cases in Excel or paper registers.
1. Download the **import template** (.xlsx) — columns match the case fields.
2. Upload filled file → system maps columns (auto-match, Admin can adjust).
3. **Preview & validate:** rows with errors highlighted (unknown lawyer email, bad date, unknown category) with reasons; Admin fixes in the file or inline.
4. Import valid rows; get a summary and a downloadable error report.
5. Imports are logged and can be **rolled back** as a batch within 24 hours.
Also supported: bulk import of users and bulk upload of documents to a case (zip with folder structure).

### 5.13 Admin Settings portal (everything configurable)
| Setting | Defaults we ship | Admin can |
|---|---|---|
| Case categories & sub-categories (**subject** — what it's about) | Debt Recovery (aeronautical charges), Contracts & Commercial, Employment, Procurement, Land & Property, Regulatory & Licensing, Compensation & Torts, Judicial Review, Criminal / Prosecution | Add, rename, recolour, reorder, deactivate |
| Matter types → lifecycle templates (**process** — how it runs) | Civil litigation, Tribunal proceedings, Arbitration / ADR, Regulatory enforcement, Debt recovery (pre-suit), Advisory — see §6 | Edit stages, order, required fields per stage, which stages allow closure, reference prefix |
| Reference pattern | `UCAA/{PREFIX}/{YYYY}/{NNNN}` (prefix per matter type, e.g. LIT, ARB, ADV) | Change pattern and prefixes |
| Courts / tribunals / forums | Uganda hierarchy (§3) + tribunals | Add, edit, deactivate |
| Event & document types / folders | Pleadings, Evidence, Correspondence, Court Orders, Submissions, Internal Memos | Add, edit |
| Deadline rules | e.g. "Notice of appeal — N days after judgment" (N set by Head of Legal) | Create rules that auto-suggest a deadline when an event is logged |
| Reminder schedules | 7/3/1 days | Change per event type |
| Closure policy | Admin approval required | Choose per matter type: lawyer closes, or lawyer requests → Admin approves |
| Outcomes list | Won, Lost, Settled, Withdrawn, Dismissed, Struck out, Advice issued | Add, edit |
| Security | 2FA required, 15-min idle timeout, 90-day password rotation | Tighten/relax within safe limits |
| Branding | UCAA logo, colours | Upload logo, set login page text |
| AI assistant | Off | Turn on/off, choose which features |

Changes to settings never break existing cases: deactivated categories/stages stay on old cases, and template edits apply to new cases (with an option to migrate open ones).

### 5.14 Org-wide reference & collaboration pages (added 2026-09-30, client-approved pitch-prototype pivot)

Four pages added alongside the per-matter tabs above, all reachable from the main nav (not nested under any one case) — the "whole department works off shared reference material" idea that came out of client feedback on the prototype:

- **Legal Documents library** (`/documents`) — org-wide, read-through list across every matter's documents (not a second upload path): searchable by name/case, links back into the owning case's Documents tab for viewing/downloading/uploading. Respects the same per-document confidentiality and access logging as the case tab.
- **External Counsel & Law Firms** (`/law-firms`) — directory of outside firms/counsel UCAA briefs or opposes: `LawFirm` model, any lawyer can add/edit, Admin can deactivate. Answers remaining question §14.2 (external firms) in the affirmative, as a directory rather than a login/portal.
- **Legal Resources & Links** (`/links`) — quick-reference links to statutes, court portals, regulators (seeded with Judiciary/URSB/URA links), grouped by category: `ResourceLink` model, any lawyer can add, Admin can deactivate.
> **Status (2026-11-07): built** as the "Department chat" conversation in the Chat hub (see CHANGELOG): live, @mentions, reply, edit, delete, unread, audited, organisation-scoped. Not yet: file attachments, voice notes, pinning (the "call/attach/voice-note controls are placeholders" sentence below is superseded for the channel; video calls are per case via LiveKit).
- **Matter Chat / Group Chat** (`/chat`) — an org-wide chat **separate from** each case's own Discussion tab: `GroupMessage` model. **Supersedes the §10/§15 "no global Messages page" decision** — the per-case Discussion tab stays (and stays strictly assignment-scoped, §4), but there is now also one department-wide channel for things that aren't about a single matter. Call/attach/voice-note controls are UI-only placeholders in the prototype — clicking them says so rather than silently doing nothing; a real calling/attachment backend is not yet built.

### 5.15 AI assistant (Later, v2 — build phase 14; switchable by Admin)
- **"Catch me up"** — summary of the case from its timeline, notes and hearing outcomes: what it's about, where it stands, what's next, open risks.
- **"What's coming up"** — natural-language briefing of the lawyer's week.
- **Draft the case summary** for the lawyer to edit (never auto-published).
- **Ask this case** — Q&A over the case's documents with citations to the source document/page.
- **Hearing prep sheet** — one page: facts, last hearing outcome, pending applications, documents to bring.
Rules: AI output is always labelled, editable, and logged; never sent outside without Admin enabling it; only reads cases the user can access; Admin can restrict AI on "Highly Confidential" cases.

## 6. Lifecycle templates

**Category vs matter type:** a matter has both. *Category* = subject (Debt Recovery, Employment, Land…) and drives reporting. *Matter type* = process and picks the lifecycle. Example: an unpaid-charges claim that went to court is category **Debt Recovery**, matter type **Civil litigation** (as in the mockup). The Admin can **change a matter's type** (e.g. pre-suit debt recovery → civil litigation when a suit is filed) using the same old → new stage mapping as lifecycle migration (FLOWS §17); the move is recorded in the timeline.

Each matter type has a configurable list of stages (Admin-editable, §5.13). Stage names are short so they fit the tracker; each stage has an optional description. Default for **civil litigation**:

```
Intake → Pre-action → Filed & served → Pleadings → Mediation
→ Scheduling conference → Hearing → Submissions → Judgment → Post-judgment → Closed
```
(*Pre-action* = demand / statutory notice. *Pleadings* ends when pleadings close. *Judgment* covers judgment or ruling. *Post-judgment* = appeal, execution, taxation of costs — each run as a sub-process.)

Other defaults:
- **Advisory:** Request received → Research → Draft → Head of Legal review → Issued → Closed
- **Arbitration / ADR:** Notice of dispute → Tribunal constituted → Statements of case → Hearing → Award → Enforcement / challenge → Closed
- **Regulatory enforcement:** Breach reported → Investigation → Notice to operator → Response → Decision → Appeal → Closed
- **Tribunal proceedings (PPDA / Tax / Industrial Court):** Application filed → Response → Hearing → Decision → Appeal → Closed
- **Debt recovery (pre-suit):** Demand notice → Negotiation / payment plan → Recovered / written off → Closed (if a suit is filed, change the matter type to Civil litigation)

**Sub-process templates** (for applications inside a matter): Interlocutory application: Filed → Heard → Ruling · Appeal: Notice of appeal → Record of appeal → Hearing → Judgment · Execution: Application → Warrant issued → Recovered · Taxation of costs: Bill filed → Taxation hearing → Certificate issued.

Stages can be skipped (e.g. settled at mediation jumps to Closed), and a matter can **jump backwards** (e.g. retrial) — every move is recorded in the timeline.

**Closing a case** depends on the lifecycle: each template marks which stages allow closure. The lawyer submits a **closure request** with outcome, closing note, final amounts (awarded/paid/recovered) and confirmation that all deadlines/tasks are done. The Admin approves or sends it back (policy configurable per type). Closed cases become read-only; the Admin can **reopen** with a reason.

## 7. Data model (starting point for Claude Code)

**Additive changes since the original draft below (all shipped, see CHANGELOG.md for migrations):**
- `User.deletedAt`, `Matter.deletedAt`/`deletedById` — soft delete (Admin-only, never hard-delete, CLAUDE.md).
- `Matter` gained intake fields from the 9-step flow (§5.5): `description`, `reportedAt`/`reportedBy`/`reportMethod`, `serviceDirection` (new `ServiceDirection` enum: `CAA_SERVING`/`CAA_SERVED`/`NOT_YET_SERVED`), `processNature`/`processIssuedAt`/`processReceivedAt`/`receivedBy`, `legalRecipientId`, `courtStation`, `filedAt`, `jurisdiction`, `representationStatus`, `externalCounselName`/`externalCounselContact`.
- `UcaaRole` extended beyond plaintiff/defendant/applicant/respondent/advisor with `CLAIMANT`, `PETITIONER`, `INTERESTED_PARTY`, `APPELLANT`, `RESPONDENT_TO_APPEAL`, `OTHER` (§5.5 step 2).
- `Party` gained `organisation`, `partyType`, `roleInMatter`.
- `MatterMessageAttachment`, `MatterMessageMention` — per-case Discussion attachments and @mentions (Phase 9).
- `LawFirm`, `ResourceLink`, `GroupMessage` — the org-wide pages in §5.14.
- `User.icsToken` — calendar subscription feed auth (§5.8).
- Time-based reminder sending is built (2026-11-07): a pg-boss job runner inside the app server (`src/instrumentation.ts` → `src/lib/jobs`) sends hearing, deadline/overdue, outcome-missing, certificate-expiring and case-inactive reminders, the 7:00 AM digest, and chat emails only when still unread. The Profile page (2026-11-07) lets each person mute types per channel and switch the digest on. Still open in Phase 8: the suspicious-activity alert.
- `ClosureRequest` is specced below but **not yet built** — `/closure-requests` is still a placeholder. See §12.

```
-- Identity & security
User(id, name, email, phone, role[ADMIN|LAWYER], title, department, practisingCertNo, certExpiry, isActive,
     mfaSecret, mfaEnabledAt, mustChangePassword, passwordChangedAt, failedLoginCount, lockedUntil,
     digestEnabled, lastLoginAt, createdAt)
Session(id, userId, createdAt, lastSeenAt, expiresAt, ip, userAgent, revokedAt)
AuthToken(id, userId, kind[INVITE|PASSWORD_RESET], tokenHash, expiresAt, usedAt, createdById)
BackupCode(id, userId, codeHash, usedAt)

-- Admin-configured reference data
Category(id, name, parentId, color, order, isActive)                      -- subject
MatterType(id, name, referencePrefix, closurePolicy[ADMIN_APPROVAL|LAWYER_CLOSES], isSubProcess, isActive)  -- process
StageTemplate(id, matterTypeId, name, description, order, allowsClosure, requiredFields[], isActive)
Forum(id, name, level, division, location, isActive)
EventType(id, name, icon, order, isActive)
DocumentFolder(id, name, order, isActive)
Outcome(id, name, order, isActive)                                        -- matter outcomes (Won, Lost, Settled…)
ReferenceCounter(prefix, year, next)

-- Matters
Matter(id, reference, title, categoryId, matterTypeId, ucaaRole, priority[LOW|MEDIUM|HIGH|URGENT],
       confidentiality[NORMAL|CONFIDENTIAL|HIGHLY_CONFIDENTIAL], status[OPEN|ON_HOLD|CLOSURE_REQUESTED|CLOSED],
       currentStageId, forumId, courtCaseNo, eccmisNo, eccmisUrl, judge,
       amountClaimed, amountAgainst, causeOfActionDate, referralNote, outcomeId, closingNote,
       createdById, createdAt, closedAt, closedById, lastActivityAt)       -- money = integer UGX
SubProcess(id, matterId, matterTypeId, title, reference, currentStageId, status, createdById, createdAt)  -- applications, appeals, execution
MatterAssignment(matterId, userId, role[LEAD|SUPPORT], assignedAt, assignedById, removedAt)
MatterAccess(matterId, userId, grantedById, grantedAt, revokedAt)          -- extra view-only access granted by Admin
MatterStage(id, matterId, subProcessId?, stageTemplateId, enteredAt, exitedAt, note, movedById)
SummaryVersion(id, matterId, body, authorId, isAiDraft, createdAt)         -- Matter shows the latest
Party(id, matterId, name, kind[OPPOSING|WITNESS|INTERNAL|OTHER], counselName, counselFirm, email, phone, address)
Event(id, matterId, subProcessId?, date, typeId, title, description, createdById, createdAt)
WizardDraft(id, userId, data json, updatedAt)

-- Dates & work
CalendarEntry(id, matterId?, subProcessId?, userId?, kind[HEARING|MENTION|MEDIATION|JUDGMENT|DEADLINE|PERSONAL],
              title, startsAt, endsAt, forumId, courtroom, purpose, isCritical, assigneeId,
              status[OPEN|DONE|NA], naReason,
              outcomeType[PROCEEDED|ADJOURNED|RULING|DIRECTIONS]?, outcomeNote, adjournmentReason,
              outcomeRecordedAt, outcomeRecordedById, nextEntryId)
Task(id, matterId, title, assigneeId, dueAt, doneAt, status[OPEN|DONE|NA], naReason, sourceEntryId?)
   -- the calendar is a merged view of CalendarEntry + Task(dueAt); tasks are never duplicated into CalendarEntry
DeadlineRule(id, triggerEventTypeId, title, offsetDays, isCritical, isActive)

-- Documents
Document(id, matterId, folderId, name, tags[], confidentiality, currentVersionId, uploadedById, deletedAt, deletedById)
DocumentVersion(id, documentId, storageKey, sha256, mimeType, size, version, encryptedDataKey, scanStatus, extractedText, uploadedById, uploadedAt)
DocumentAccessLog(id, documentId, userId, action[VIEW|DOWNLOAD|PRINT|SHARE], ip, at)
EventDocument(eventId, documentId)                                          -- evidence links; blocks deletion without Admin

-- Collaboration
Message(id, matterId, authorId, body, parentId, pinned, editedAt, deletedAt, createdAt)
MessageAttachment(messageId, documentId)
Mention(messageId, userId)
Note(id, matterId, authorId, body, isPrivate, updatedAt)
ClosureRequest(id, matterId, requestedById, outcomeId, note, amountAwarded, amountPaid, amountRecovered, amountCosts,
               status[PENDING|APPROVED|RETURNED], reviewedById, reviewNote, createdAt, reviewedAt)

-- Notifications, reporting, admin
Notification(id, userId, type, matterId, payload, readAt, emailedAt, createdAt)
NotificationRule(id, eventType, offsets[], channels[], mutable)
NotificationPreference(userId, type, inApp, email)                         -- only for mutable types
SavedView(id, userId, name, filters json, createdAt)
ScheduledReport(id, reportKey, filters json, schedule, recipients[], createdById, isActive, lastRunAt)
ImportBatch(id, kind, fileKey, rowsTotal, rowsOk, rowsFailed, errorReportKey, createdById, createdAt, rolledBackAt)
Setting(key, value, updatedById, updatedAt)
AiInteraction(id, userId, matterId, feature, promptHash, createdAt)
AuditLog(id, userId, action, entity, entityId, before, after, ip, userAgent, createdAt)   -- append-only
```

## 8. Screens list (design in this order)

1. Login + 2FA + forced password change
2. Shared dashboard (Admin sees the whole portfolio; a lawyer sees matters they lead/support — §5.3)
3. **Case page** (most design time)
4. Case list (sort / filter / time filter)
5. Calendar (lawyer + department)
6. New case intake (9 steps, §5.5)
7. Closure request + approval *(not yet built — Phase 10, §12)*
8. Users (list, create, reassign)
9. Admin Settings portal (categories, lifecycles, courts, deadline rules, reminders, security)
10. Import wizard (cases) *(not yet built — Phase 12, §12)*
11. Reports *(not yet built — Phase 11, §12)*
12. Notifications panel
13. Document viewer (secure, watermarked)
14. Legal Documents library, Law Firms & Counsel, Resource Links, Group Chat (§5.14)
15. Profile & preferences
16. Empty, loading, error, 403, session-expired screens

## 9. Document & data security ("as safe as it can be")

Legal files are the most sensitive thing in the system. Defence in depth:

**Storage**
- Every file is **encrypted at rest** with its own key (envelope encryption: per-file data key, wrapped by a master key held outside the database — env secret / KMS / Vault).
- Files live in private object storage; **no public URLs ever**. Downloads go through the app, which checks permission, then streams the file or issues a URL valid for ~60 seconds.
- SHA-256 hash stored per version → proves a document wasn't altered (important for evidence).
- Uploads are **virus-scanned** (ClamAV) before becoming available; file type verified by content, not extension; size limits.
- Versions are never overwritten; deletes are soft and Admin-only restorable for a retention period.

**Access**
- Permission check on every request (case assignment + confidentiality level).
- **Highly Confidential** cases: hidden from search for non-assigned users, download disabled by default (view-only), AI disabled unless Admin allows.
- In-browser viewer adds a **watermark** (user name + date/time) on view, print and download of PDFs.
- Every view / download / print is logged (DocumentAccessLog); Admin gets an alert on unusual volume.

**Accounts**
- 2FA mandatory, strong passwords (checked against breached-password lists), lockout after failed attempts, idle timeout, sessions revocable by Admin, "sign out everywhere".
- Admin actions (permission changes, settings, exports) require re-entering the password.

**Platform**
- HTTPS only (TLS 1.2+), secure cookies, CSRF protection, strict Content-Security-Policy, rate limiting.
- Database encrypted at rest; least-privilege DB user; parameterised queries (Prisma).
- **Encrypted, automated backups** — daily, kept off the main server, restore tested monthly.
- Append-only audit log; dependency scanning; security review/pen test before go-live.
- Data retention: Admin sets how long closed case files are kept; nothing is purged without Admin confirmation.

## 10. Design system — "clean, warm, professional blue"

Direction from the client: white and clean like the reference images, warm (not cold/sterile). One bold, saturated blue accent (`#4169E1`, revised 2026-09-26 from an earlier muted mid-tone blue) — not navy, not baby blue. Confidential, trustworthy, with a modern, confident edge. Inputs, selects and dropdowns share the same rounded corners as buttons and cards (revised 2026-09-27 from an earlier sharp-cornered input style, which read as inconsistent next to rounded buttons in the same toolbar).

**Colour tokens**
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#F7F6F3` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, sidebar, modals |
| `--surface-muted` | `#F1EFEB` | Hover rows, secondary buttons, inputs bg |
| `--border` | `#E6E3DD` | Card & input borders (warm grey) |
| `--text` | `#1F2328` | Headings & body |
| `--text-muted` | `#6B6760` | Meta text, labels |
| `--primary` | `#4169E1` | Primary buttons, active nav, current stage, links |
| `--primary-hover` | `#3759BF` | Hover/pressed |
| `--primary-soft` | `#E8EDFC` | Selected rows, active nav bg, info chips |
| `--success` | `#2E7D5B` / soft `#E6F3EC` | On track, won, done |
| `--warning` | `#B7791F` / soft `#FBF1E1` | Due soon |
| `--danger` | `#C0392B` / soft `#FBE9E7` | Overdue, critical, lost |
| `--neutral-chip` | `#8A857D` / soft `#EFEDE9` | Closed, archived |

| `--avatar-1..3` | `#4169E1` / `#7A6A55` / `#4F7A6B` | Team avatars (assigned by user, cycling) — the only other fills allowed |

**Dark mode:** tokens are defined for both themes from day one (dark values are in `docs/design/case-page.html`); the user picks Light / Dark / System in Profile & preferences. No theme toggle in the top bar.

**Type:** **Inter** for all UI. **Source Serif 4** (600) only for the page/case title (H1) — gives the warmth; italic muted "v." between parties. Page title 28–30px, card/section title 16px/600, body 14px/400, meta 12–13px `--text-muted`. Numbers (KPIs, dates, money, counts) use tabular figures; KPI numbers 32–40px/600.

**Shape & space:** cards radius 16px, inputs/buttons 10px, chips full-round; card padding 20–24px; 8px spacing grid; shadows barely visible (`0 1px 2px rgba(31,35,40,.04)`).

**Icons:** lucide only — no emoji in the UI (the AI sparkle uses lucide `Sparkles`).

**Layout:** left sidebar (blue-filled, collapsible to icons-only with hover tooltips, revised 2026-09-26 — brand mark + "CAA Legal Department" top, nav with count chips, user card bottom). Top bar: breadcrumbs · search (shows **Ctrl K** on Windows, **⌘K** on Mac) · bell (notifications **and** @mentions). Content max-width 1440px. "+ New matter" lives on the Cases page itself, not the top bar (revised 2026-09-27). Per-case Discussion stays assignment-scoped and is the only place chat is tied to one matter (§4) — but there is now also a department-wide **Matter Chat** page (§5.14), superseding the original "no global Messages page" rule.

**Nav, same list for every role (revised 2026-10-08 terminology pass — org-wide visibility means Admin and lawyers now share one nav, not two):** Legal Dashboard · Legal Matters · Legal Calendar · Tasks & Legal Deadlines · Legal Documents · External Counsel & Law Firms · Legal Resources & Links · Matter Chat · Legal Reports & Analytics. **Admin additionally gets:** Matter Closure Requests · Users & Access · Legal System Settings. Profile & preferences from the user card. Sidebar brand reads "CAA Legal Department".

**Confidential feel:** "Confidential" / "Highly Confidential" lock chip on case headers and documents; subtle, never alarming. Blur/mask amounts and party names on the dashboard until hovered (optional setting) — useful when screens are visible in meetings.

**Rules:** one blue, used sparingly; everything else neutral. Status colours only in chips/dots, never big fills. If a screen has more than one strong colour competing, remove one.

## 11. Recommended tech stack (hosting-agnostic)

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 24 LTS, npm | Installed on dev machine |
| Framework | Next.js (App Router) + TypeScript | Matches v0 output, one codebase |
| UI | Tailwind + shadcn/ui + lucide icons | Clean look, matches mockups |
| Lifecycle diagram | Custom SVG/Tailwind stepper; React Flow if branching grows | Full control |
| Calendar | FullCalendar (React), themed with our tokens | Month/week/day/agenda views |
| DB | PostgreSQL + Prisma | Relational, full-text search |
| Auth | Better Auth (+ its TOTP 2FA plugin) | Admin-created accounts only; DB sessions (revocable) |
| File storage | S3-compatible API (AWS S3, MinIO on-prem, etc.) + app-level envelope encryption | Same code on any host |
| Virus scan | ClamAV container | |
| Realtime | Server-Sent Events (Postgres LISTEN/NOTIFY behind it) | Chat & live notifications; no extra server |
| Jobs | pg-boss, started inside the Next.js server (instrumentation hook) | Reminders, digests, unread-chat emails; later imports, scheduled reports, AI jobs. Can move to a separate worker process later without changing the jobs themselves |
| Import/Export | SheetJS / exceljs; PDF via a headless renderer | |
| Email | SMTP | Works with any mail server |
| AI (Later, v2) | Claude API behind a feature flag | Summaries, briefings, Q&A |
| Deploy | Docker Compose (app, worker, postgres, minio, clamav) | Runs anywhere |

## 12. Build phases (feed to Claude Code one at a time)

Status as of 2026-10-11 marked inline — **DONE**, **PARTIAL**, or **NOT BUILT** — so the phase list doubles as the real build tracker, not just the original plan.

0. **Setup** — git repo, Next.js, Tailwind + design tokens (§10, both themes), shadcn, Prisma, Docker Compose, app shell (sidebar + top bar) with empty pages, seed (1 admin with temp password, 4 lawyers). **DONE**
1. **Auth & security base** — login screen, invite activation, 2FA + backup codes, forced password change, forgot password, roles, route protection, audit log, session management & lockout. **DONE** (plus a `DEMO_LOGIN_PASSWORD` prototype shortcut, §4 — must be unset before go-live)
2. **Admin Settings** — categories, matter types & lifecycle templates, forums, outcomes, reminder rules (seeded with defaults). **DONE**
3. **Users** — list, create, deactivate, reassign. **DONE** (plus soft delete, filters, Excel/PDF export, flexible import+rollback — see CHANGELOG)
4. **Cases core** — wizard, case list with sort/filter/time filter, assignment. Seed grows to 15 realistic cases (the mockup case among them). **DONE** (wizard later became the 9-step intake, §5.5)
5. **Case page** — header, lifecycle diagram, catch-up panel, timeline, parties, notes, stage moves. **DONE** (catch-up panel became the Overview panel, §5.7)
6. **Secure documents** — encrypted upload, scan, versions, viewer with watermark, access log. **DONE**
7. **Calendar, hearings, deadlines, tasks** — outcome recording, deadline rules, clash detection, .ics. **DONE**
8. **Notifications** — in-app, email, reminder jobs, digest. **MOSTLY DONE (2026-11-07)** — event-triggered notifications plus the job runner: pg-boss scheduled once a minute inside the Next.js server (`src/instrumentation.ts`, `src/lib/jobs`), so one deploy runs everything and several instances still run each tick once. It sends hearing reminders (7/1 days, morning of), deadline and task reminders (7/3/1 days + overdue, Admin told when overdue), hearing-passed-no-outcome (lead lawyer, then Admin), practising-certificate-expiring (lawyer + Admin), case-inactive (one combined notice per person), the optional 7:00 AM digest, and chat emails only if still unread after the `CHAT_UNREAD_EMAIL` delay. Every schedule is read from Admin Settings → Reminders. Profile & preferences (`/profile`) lets each person switch the digest on and mute any mutable type per channel. **Not built yet:** the suspicious-activity alert (needs download/login analysis) and the theme choice in Profile (the app is still pinned to light).
9. **Case discussion (chat)** — realtime, mentions, pins, attachments. **DONE**
10. **Closure workflow** — request, approve/return, reopen. **NOT BUILT** — no `ClosureRequest` model yet; `/closure-requests` is a placeholder; case header has no working "Request closure" action.
11. **Dashboards & reports** — with filters, drill-down, exports, scheduled reports. **PARTIAL** (2026-11-01) — all 9 report types from §5.10 built (Case register, By status/category/court, Outcomes, Average duration, Financial exposure, Lawyer workload, Upcoming hearings, Overdue deadlines, Inactive cases), each with the shared filter bar, time filtering, and CSV/Excel/PDF export; status/category/court charts drill into the Case register. Still missing: **scheduled reports** (e.g. monthly case register emailed to the Head of Legal) — no job runner exists for that yet, same gap noted under Notifications (item 8).
12. **Import** — template, mapping, validation, rollback **for matters**. **NOT BUILT** — `/import` is a placeholder; do not confuse with the already-built *user* import at `/users/import` (Phase 3).
13. **Hardening** — rate limits, CSP, backups + restore test, accessibility, e2e tests, pen-test fixes. **NOT BUILT** — only baseline security headers exist today (no CSP, no rate limiting, no backup/restore script).
14. **AI assistant** — behind Admin switch. **NOT BUILT** (as planned — Later v2).

Each phase ends with a working demo, updated seed data and a CHANGELOG entry. The seed grows with each phase — it only seeds tables that exist.

## 13. Definition of done (every feature)
- Works for both roles with correct permissions (tested)
- Empty, loading and error states
- Written to the audit log
- Responsive down to tablet
- Server-side validation (zod); no secrets in code
- Uses design tokens only — no ad-hoc colours

## 14. Remaining questions for the client
1. Roughly how many lawyers and active cases today? (sizing, import planning)
2. Do they brief **external law firms** on some cases? Partially answered by the prototype: `externalCounselName`/`externalCounselContact` fields on intake plus a shared **External Counsel & Law Firms** directory (§5.14) exist; an external firm *login/portal* is still open.
3. Email system (Outlook/Exchange?) for sending mail and calendar subscription
4. Retention period for closed files
5. Official logo files (the colour direction is agreed — see §10)

## 15. Decisions log
| Date | Decision |
|---|---|
| 2026-09-26 | Hosting-agnostic build; no fixed host required |
| 2026-09-26 | Admin can configure everything; system ships with defaults (categories, stages, courts, rules) |
| 2026-09-26 | Import and reporting in scope, with sorting, filtering and time filtering |
| 2026-09-26 | Case closure follows the lifecycle; Admin controls/approves closure |
| 2026-09-26 | Every lawyer gets a calendar showing their case dates and what each date is for |
| 2026-09-26 | Documents must be secured to the highest practical standard |
| 2026-09-26 | AI assistance (summaries, reminders) planned for a later phase |
| 2026-09-26 | Visual direction: clean white, warm neutrals, one professional mid-tone blue; confidential feel |
| 2026-09-26 | Case page mockup (`docs/design/case-page.html`) is the visual reference; spec reconciled to it |
| 2026-09-26 | Lawyers onboard via 72 h invite link; only the seeded Admin uses a temporary password |
| 2026-09-26 | Category = subject, matter type = process/lifecycle; matter type can be changed with stage mapping |
| 2026-09-26 | Short stage names; post-judgment work (appeal, execution, costs) runs as sub-processes |
| 2026-09-26 | Serif (Source Serif 4) for page titles only; Inter elsewhere; dark theme tokens from day one |
| 2026-09-26 | No global Messages page — chat is per case; bell covers notifications + mentions |
| 2026-09-26 | Stack fixed: Better Auth + TOTP, FullCalendar, SSE, Node 24 + npm |
| 2026-09-26 | Wizard is 5 steps (documents in step 5); seed grows per phase, cases arrive in Phase 4 |
| 2026-09-26 | Primary blue revised to `#4169E1` (bolder/more saturated); login is a split layout, not a centred card; input fields are sharp-cornered |
| 2026-09-26 | 2FA enforcement made a togglable env flag (`REQUIRE_2FA`) for easier testing — must be `true` before go-live (spec still requires 2FA on every account) |
| 2026-09-27 | Inputs/selects/dropdowns switched from sharp corners to the same rounded corners as buttons — seeing sharp inputs next to rounded buttons live read as inconsistent |
| 2026-09-29 | **Client approved the pitch prototype as the new v1 baseline.** Permission model revised: org-wide read access to every matter (not assigned-only); editing (stage, parties, summary, notes, closure) stays gated to Admin/Lead/Support. Per-case Discussion chat is the one thing that stays strictly assignment-scoped. Dashboard unified into one shared component, scoped per role rather than two separate designs; `/my-day` redirects to it. |
| 2026-09-29 | `DEMO_LOGIN_PASSWORD` added: an env-gated shared password so every lawyer can sign in immediately for demos, bypassing the real invite-link/2FA-setup path. Off (unset) by default outside the demo; must stay unset in production. `REQUIRE_PASSWORD_CHANGE` added alongside `REQUIRE_2FA` as the same kind of dev-only togglable gate. |
| 2026-09-30 | Four org-wide pages added outside any single case: Legal Documents library, External Counsel & Law Firms, Legal Resources & Links, and a department-wide Matter Chat (`GroupMessage`). The last one **supersedes** the earlier "no global Messages page" decision — per-case Discussion remains separate and stays assignment-scoped. |
| 2026-10-01 | New case wizard redone as a 9-step intake (was 5 steps) matching client-provided intake mockups; "Case in 30 seconds" renamed **Overview**, gaining a status banner and the intake fields (service/process, court/forum, representation) as read-back; Parties folded into the Overview panel rather than kept as a separate case-page tab. |
| 2026-10-01 | Soft delete extended to `User` and `Matter` (Admin-only; never hard-delete, per CLAUDE.md) — a deleted case 404s everywhere but keeps its documents and audit history. |
| 2026-10-08 | Full legal-terminology pass applied across the UI (nav, dashboard copy, stage names) per the department's language standard — "Case" gives way to "Matter" in headings; nav renamed to Legal Dashboard / Legal Matters / Legal Calendar / Tasks & Legal Deadlines / Legal Documents / External Counsel & Law Firms / Legal Resources & Links / Matter Chat / Legal Reports & Analytics / Matter Closure Requests / Users & Access / Legal System Settings. Sidebar brand reads "CAA Legal Department". |
| 2026-10-15 | Client feedback from the prototype demo: added a **Contracts register** — a dedicated `/contracts` dashboard + list, a short intake at `/contracts/new` (not the 9-step litigation wizard), and five Admin-configurable parallel tracking statuses (Receipt, Legal Review, Internal Approval, AG Vetting, Amendments) plus CAA/counterparty execution status on a new `ContractDetail` model. The Contract matter type's own lifecycle (Not Yet Effective → Active/In Force → … → Closed/Archived) still drives its stage tracker. Placeholder/example text swapped from generic "XYZ" to a relatable seeded matter, and seed data pared to real matters (two ULII judgments) plus two contract examples, applied to both local and production. |
| 2026-10-17 | A contract was accidentally deleted via the Legal Matters list's "Delete" action — a direct consequence of Contracts being built as a Matter subtype. **Contracts restructured to be fully independent of Matter**: a standalone `Contract` model (own reference series, own lifecycle via `ContractStage` rather than `MatterType`/`StageTemplate`) with full parity — its own team assignment (`ContractAssignment`), encrypted/versioned documents (`ContractDocument*`), audit logging and notifications — so a contract can never again be touched by a Matter-scoped action. The old Contract matter type is deactivated (never deleted, per CLAUDE.md). Both existing contracts' data and team assignments were carried across in the same migration, applied to local and production. Also added two more real ULII-judgment matters (Okalany, Nsamba), bringing litigation to four real matters alongside Besigye and Makuza, each with a source-document link editable from its own page. |
| 2026-10-25 | Back on the phased build after the prototype detour (mid-timeline the client asked for a demo-ready prototype rather than shipping increment by increment — that detour is what produced the Contracts work and the real-case seeding above). **Multi-tenancy foundation laid**: a `Superadmin` role above Admin, an `Organization` model (name, logo, one accent colour), and `organizationId` on `User`/`Matter`/`Contract`. The capability is real multi-tenant SaaS; in practice CAA remains the only organisation, created via a data migration that backfilled every existing record onto it. Superadmin creates/brands organisations and invites their first Admin at `/superadmin`; 2FA stays off via the existing `REQUIRE_2FA` toggle for now. Next: go through the Admin-facing pages one at a time to back each with real, organisation-scoped queries (today only a handful of "list every user" queries were fixed to exclude Superadmin — a fuller sweep is pending). |
