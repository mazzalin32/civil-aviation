# CAA Legal — Case & Matter Management System
**Client:** Uganda Civil Aviation Authority (UCAA) — Legal Department
**Document owner:** You (lead designer/developer) · **Build tool:** Claude Code
**Status:** v1.2 — client decisions recorded, spec/flows/mockup reconciled (see §15). Companion files: `FLOWS.md` (every user flow, step by step) · `docs/design/case-page.html` (reference mockup of the case page)

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
| **Admin (Supervisor)** | Director Legal / Head of Legal | Everything: create/deactivate users, create cases, assign/reassign lawyers, view all cases, approve case closure, import data, run reports, and **configure the whole system** from the Admin Settings portal (§5.13) |
| **Lawyer** | Legal officers / counsel | See assigned cases (lead or supporting), update stage, add events, upload documents, set deadlines, chat, write notes |
| *(Later, v2)* **Registry Clerk** | Legal assistant | Log incoming documents/court papers, schedule dates, no strategy notes |
| *(Later, v2)* **Viewer** | DG / management | Read-only dashboards and case summaries |

**Rules:**
- **Configuration principle:** the system ships with sensible defaults (categories, stages, courts, deadline rules, reminders), and the Admin can add, rename, reorder, deactivate or change any of them in the portal. Nothing legal is hard-coded.
- A case has one **Lead Lawyer** and zero or more **Supporting Lawyers**.
- Lawyers only see cases they're assigned to (Admin can grant view access to others).
- **Private notes** on a case are visible only to their author + Admin.
- Every action is written to an **audit log** (who, what, when). Legal work demands this.
- No public sign-up. Accounts are created by Admin only. A new lawyer gets a **single-use invite link (valid 72 h)** to set their own password and 2FA — the Admin never knows or sends a password. Only the first seeded Admin uses a temporary password, which must be changed at first login. 2FA via authenticator app (TOTP) with backup codes.

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

### 5.3 Lawyer Dashboard ("My Day")
- Today & this week: hearings, deadlines, tasks
- My cases list with stage chip and next date
- Unread messages / mentions
- Overdue items pinned at the top in red

### 5.4 User Management (Admin)
Create lawyer (name, email, phone, title, practising certificate no. + expiry, department). Deactivate (never hard-delete — keeps history). Reassign all of a departing lawyer's cases in one action.

### 5.5 Case/Matter creation (Admin) — 5-step wizard, draft auto-saved
1. **Basics:** title (e.g. *UCAA v. XYZ Aviation Ltd*), category + sub-category (**what it's about** — from Admin-configured list), matter type (**how it runs** — picks the lifecycle template), UCAA's role (plaintiff/defendant/applicant/respondent/advisor), priority, confidentiality level
2. **Forum:** court/tribunal, division, location, court case number, ECCMIS number, judge/registrar (skippable for advisory matters)
3. **Parties:** opposing parties, opposing counsel (name, firm, contacts), witnesses, internal UCAA contact person (the department that raised it)
4. **Facts & value:** short description, amount claimed / exposure (UGX), date cause of action arose, how it came to Legal (referral memo)
5. **Assign & start:** lead + supporting lawyers (dropdown shows workload + next free day), initial stage, first deadline/hearing, initial documents

### 5.6 Case List
Table view + card view. **Sort** by any column (opened date, next date, last activity, priority, value, title). **Filter** by status, stage, category, type, court, lawyer, priority, UCAA role, value range. **Time filters:** Today · This week · This month · This quarter · This year · Custom range — applied to a chosen date field (opened, closed, next hearing, last activity). Search across title, case number, ECCMIS number, parties. Saved filter views; export the current filtered list to Excel/PDF.

### 5.7 The Case Page — the heart of the product

Layout (desktop), top to bottom:

**A. Header:** Case title, reference, court case number, ECCMIS no., court, status chip, priority chip, confidentiality lock chip, team avatars (lead first), action buttons: **Add event · Upload · Move stage** (primary) · **⋯ menu** (Schedule hearing, Add deadline, New application, Reassign *(Admin)*, Put on hold, Request closure).

**B. Lifecycle diagram** — horizontal stage tracker (see §6). Shows template name + category, "Stage X of Y · N days open". Completed stages filled with a check, current stage ringed and pulsing softly (off under reduced-motion), future stages outlined and numbered. Click a stage to see what happened in it (dates, events). Sub-processes (e.g. an injunction application) show as small branches under the main line.

**C. "Case in 30 seconds" panel** (the memory feature) — two columns:
- *Left:* **Summary** — three short paragraphs: *What it's about · Where it stands · What's next*. Written/edited by the lawyer (previous versions kept); "Edited by X · when" chip. Pinned discussion messages appear under it. The ✨ AI button only appears when the Admin has enabled AI (Later, v2).
- *Right column:* **Key facts** card (next date & purpose highlighted, amount at stake, UCAA role, judge, opposing counsel, category, last activity) · **Deadlines** card (open deadlines with days-left chips, time spent in the current stage) · **Team** card (lead/support).

**D. Tabs:**
1. **Timeline** — every event in order: filings, hearings, adjournments (with reason), rulings, correspondence, stage changes, assignment changes. Each event: date, type icon, short description, linked documents, who logged it. Filterable by type.
2. **Documents** — grouped by folder (Pleadings, Evidence, Correspondence, Court Orders, Submissions, Internal Memos). Version history, preview (PDF/images), uploaded-by, date, tags. Drag-and-drop upload.
3. **Hearings & Deadlines** — calendar + list. Each hearing records outcome afterwards (adjourned to X / proceeded / ruling delivered). Deadlines have a reminder schedule.
4. **Tasks** — checklist items with assignee and due date ("Draft witness statement", "Serve summons").
5. **Discussion** — chat thread for this case only; @mentions; attach documents from the case; pin important messages.
6. **Parties & Contacts**
7. **Notes** — shared notes + private notes.
8. **Activity** — who did what on this case, including document views. Assigned lawyers see case activity; Admin additionally sees the full audit detail (before/after values, IP).

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

### 5.14 AI assistant (Later, v2 — build phase 14; switchable by Admin)
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
2. Lawyer dashboard ("My Day")
3. **Case page** (most design time)
4. Case list (sort / filter / time filter)
5. Calendar (lawyer + department)
6. Admin dashboard
7. New case wizard
8. Closure request + approval
9. Users (list, create, reassign)
10. Admin Settings portal (categories, lifecycles, courts, deadline rules, reminders, security)
11. Import wizard
12. Reports
13. Notifications panel
14. Document viewer (secure, watermarked)
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

Direction from the client: white and clean like the reference images, warm (not cold/sterile). One bold, saturated blue accent (`#4169E1`, revised 2026-09-26 from an earlier muted mid-tone blue) — not navy, not baby blue. Confidential, trustworthy, with a modern, confident edge. Input fields are sharp-cornered (no radius); cards and buttons keep their rounded corners.

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

**Layout:** left sidebar 248px (white, logo + "CAA Legal / Uganda Civil Aviation Authority" top, nav with count chips, user card bottom). Top bar: breadcrumbs · search (shows **Ctrl K** on Windows, **⌘K** on Mac) · "New case" primary button (**Admin only**) · bell (notifications **and** @mentions). Content max-width 1440px. Chat lives only inside each case — there is no separate Messages page.

**Lawyer nav:** My Day · My cases · My calendar · Tasks. **Admin nav:** Dashboard · Cases · Calendar · Closure requests · Users · Reports · Import · Settings. Profile & preferences from the user card.

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
| Jobs | pg-boss worker | Reminders, digests, imports, scheduled reports, AI jobs |
| Import/Export | SheetJS / exceljs; PDF via a headless renderer | |
| Email | SMTP | Works with any mail server |
| AI (Later, v2) | Claude API behind a feature flag | Summaries, briefings, Q&A |
| Deploy | Docker Compose (app, worker, postgres, minio, clamav) | Runs anywhere |

## 12. Build phases (feed to Claude Code one at a time)

0. **Setup** — git repo, Next.js, Tailwind + design tokens (§10, both themes), shadcn, Prisma, Docker Compose, app shell (sidebar + top bar) with empty pages, seed (1 admin with temp password, 4 lawyers).
1. **Auth & security base** — login screen, invite activation, 2FA + backup codes, forced password change, forgot password, roles, route protection, audit log, session management & lockout.
2. **Admin Settings** — categories, matter types & lifecycle templates, forums, outcomes, reminder rules (seeded with defaults).
3. **Users** — list, create, deactivate, reassign.
4. **Cases core** — wizard, case list with sort/filter/time filter, assignment. Seed grows to 15 realistic cases (the mockup case among them).
5. **Case page** — header, lifecycle diagram, catch-up panel, timeline, parties, notes, stage moves.
6. **Secure documents** — encrypted upload, scan, versions, viewer with watermark, access log.
7. **Calendar, hearings, deadlines, tasks** — outcome recording, deadline rules, clash detection, .ics.
8. **Notifications** — in-app, email, reminder jobs, digest.
9. **Case discussion (chat)** — realtime, mentions, pins, attachments.
10. **Closure workflow** — request, approve/return, reopen.
11. **Dashboards & reports** — with filters, drill-down, exports, scheduled reports.
12. **Import** — template, mapping, validation, rollback.
13. **Hardening** — rate limits, CSP, backups + restore test, accessibility, e2e tests, pen-test fixes.
14. **AI assistant** — behind Admin switch.

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
2. Do they brief **external law firms** on some cases? (external counsel fields / limited access later)
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
