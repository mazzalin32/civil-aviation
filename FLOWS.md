# CAA Legal — Full System Flows
Companion to `PROJECT_SPEC.md`. Every journey through the system, step by step, with diagrams (Mermaid — renders on GitHub, VS Code, and most markdown viewers).

**Legend used in steps:** 🟦 Admin action · 🟩 Lawyer action · ⚙️ System does it automatically · 🔔 Notification sent · 📝 Audit log entry

---

## 0. The big picture

```mermaid
flowchart LR
    A[Admin sets up system<br/>categories, lifecycles, rules] --> B[Admin creates lawyer accounts]
    B --> C[Admin creates case<br/>& assigns lawyers]
    C --> D[Lawyer works the case<br/>stages, hearings, documents, chat]
    D --> E{Stage allows closure?}
    E -- No --> D
    E -- Yes --> F[Lawyer requests closure]
    F --> G{Admin reviews}
    G -- Return --> D
    G -- Approve --> H[Case closed & read-only]
    H -. reopen with reason .-> D
    D --> R[Reports & dashboards]
    H --> R
```

**Site map (revised 2026-09-29/2026-10-08 — client-approved prototype: one shared nav for every role, org-wide read access; see PROJECT_SPEC.md §4/§10/§15)**

```
Shared nav (every role)                 Admin-only additions
├── Legal Dashboard (scoped per role)   ├── Matter Closure Requests *(not built — Phase 10)*
├── Legal Matters ─ Case page           ├── Users & Access
├── Legal Calendar                      └── Legal System Settings
├── Tasks & Legal Deadlines                 ├── Categories
├── Legal Documents (org-wide library)      ├── Matter types & lifecycles
├── External Counsel & Law Firms            ├── Courts & forums
├── Legal Resources & Links                 ├── Outcomes / event & document types
├── Matter Chat (department-wide)            ├── Deadline rules & reminders
└── Legal Reports & Analytics *(not built — Phase 11)*  ├── Security
                                             ├── Branding
Top bar: search · bell (notifications + @mentions)      └── AI assistant
User card: Profile & preferences (theme, digest, mutes)
Per-case Discussion is still its own thread, assignment-scoped (not the department-wide Matter Chat above)
```

---

## 1. First-time system setup (Admin)

1. ⚙️ Installation seeds one Admin account + all defaults (categories, lifecycles, courts, outcomes, reminder rules).
2. 🟦 Admin logs in with the temporary password → forced to set a new password → sets up 2FA (scans QR code in an authenticator app, confirms a code, downloads backup codes).
3. 🟦 Admin opens **Settings** and reviews defaults: renames / adds / deactivates categories, edits lifecycle stages, adds courts, sets closure policy and reminder schedules.
4. 🟦 Uploads UCAA logo, sets login page text.
5. 📝 Every setting change is logged with before/after values.

```mermaid
flowchart TD
    S[Seeded Admin account] --> L[Login with temp password]
    L --> P[Set new password]
    P --> M[Set up 2FA + backup codes]
    M --> ST[Settings: review defaults]
    ST --> C1[Categories]
    ST --> C2[Lifecycles]
    ST --> C3[Courts]
    ST --> C4[Rules & reminders]
    ST --> C5[Branding]
    C1 & C2 & C3 & C4 & C5 --> READY[System ready]
```

---

## 2. Login (everyone)

1. Enter email + password.
2. ⚙️ Checks: account active? locked? password correct? → after 5 failures (configurable) account locks for 15 min, 🔔 Admin alerted.
3. Enter 2FA code (or backup code).
4. ⚙️ If first login or password expired → forced password change.
5. Land on dashboard (Admin → Admin Dashboard, Lawyer → My Day).
6. ⚙️ Idle 15 min → screen locks, re-enter password to continue (unsaved form data kept).

**Forgot password:** enter email → ⚙️ always shows "If this email exists, a link was sent" (never reveals which emails exist) → link valid 30 min, single use → set new password → all other sessions signed out → 🔔 email "your password was changed".

```mermaid
flowchart TD
    A[Email + password] --> B{Valid?}
    B -- No --> F[Count failure] --> G{≥ 5 failures?}
    G -- Yes --> H[Lock 15 min + alert Admin]
    G -- No --> A
    B -- Yes --> C[2FA code]
    C --> D{Valid?}
    D -- No --> C
    D -- Yes --> E{First login or<br/>password expired?}
    E -- Yes --> P[Set new password] --> DB
    E -- No --> DB{Role}
    DB -- Admin --> AD[Admin Dashboard]
    DB -- Lawyer --> LD[My Day]
```

---

## 3. Onboarding a lawyer (Admin)

1. 🟦 Users → **Add lawyer**: name, email, phone, title, practising certificate no. + expiry.
2. ⚙️ Account created with a one-time invite link (valid 72 h). 🔔 Email to the lawyer. 📝
3. 🟩 Lawyer opens link → sets password → sets up 2FA → lands on an empty dashboard with a short 3-step welcome ("Your matters will appear here", "Your calendar fills automatically", "Turn on email digests").
4. Invite expired? 🟦 Admin clicks **Resend invite**.

**Prototype shortcut (env-gated, `DEMO_LOGIN_PASSWORD` — see PROJECT_SPEC.md §4/§15):** when set, every invited/seeded lawyer can instead sign in immediately with one shared password — skips steps 2–3's activation link entirely. Must be unset in production; the real invite-link flow above is what ships to the client.

**Offboarding:** 🟦 Users → lawyer → **Deactivate** → system shows their open cases → Admin reassigns them (all to one person or one by one) → ⚙️ sessions revoked, account disabled, history kept, 🔔 new lead lawyers notified. 📝

---

## 4. Creating & assigning a case (Admin)

1. 🟦 **+ New matter** (Cases page) → 9-step intake with progress rail, draft auto-saved (revised 2026-10-01 from the original 5-step wizard — see PROJECT_SPEC.md §5.5):
   1. **Matter identification** — title, reference preview, category/sub-category, matter type (this picks the lifecycle).
   2. **CAA position & reporting** — UCAA's role, priority, confidentiality, how it was reported to Legal.
   3. **Service / legal process** — service direction, process nature, issued/received dates, response-deadline countdown.
   4. **Parties** — opposing parties & counsel, witnesses, internal UCAA contact.
   5. **Court & judicial information** — court/tribunal, division, court station, location, case number, ECCMIS number, judge. (Skippable for advisory matters.)
   6. **Legal representation** — representation status, external counsel name/contact.
   7. **Matter stage** — starting stage, first deadline/hearing.
   8. **Documents** — initial documents (uploaded right after creation through the normal encrypted pipeline).
   9. **Review & submit** — full read-back before creating.
2. ⚙️ Duplicate check: warns if a case with the same court number or same parties exists.
3. ⚙️ Generates reference (e.g. `UCAA/LIT/2026/0042`, pattern set in Settings), creates first timeline event "Case opened", places dates on assigned lawyers' calendars. 📝
4. 🔔 Assigned lawyers: "You've been assigned *UCAA v. Nile Horizon Aviation Ltd* as Lead Counsel."

```mermaid
sequenceDiagram
    actor Admin
    participant App
    participant DB
    actor Lawyer
    Admin->>App: New matter intake (9 steps)
    App->>DB: Check duplicates
    DB-->>App: None / warning
    Admin->>App: Confirm & assign lawyers
    App->>DB: Create matter, stage, event, calendar entries, audit
    App-->>Lawyer: In-app + email notification
    Lawyer->>App: Opens case page
```

**Reassignment:** case page → ⋯ → **Reassign** → pick new lead / add or remove supporting → reason (optional) → ⚙️ calendars updated, timeline event added, 🔔 old and new lawyers notified. 📝

---

## 5. A lawyer's day (shared Legal Dashboard, revised 2026-09-29 — "My Day" is no longer a separate page; `/my-day` redirects here)

1. 🟩 Logs in → **Legal Dashboard** shows, in order:
   - 🔴 Overdue items (always pinned on top)
   - Today: hearings (time, court, courtroom, purpose) and deadlines
   - "Record outcome" cards for yesterday's hearings not yet updated
   - This week (compact list)
   - My matters (stage chip + next date), unread messages & mentions
   - (Later, v2) ✨ "Your week at a glance" AI briefing
2. 🟩 Clicks any item → goes straight to the right case tab (e.g. hearing → Deadlines tab with that hearing open).
3. ⚙️ Optional 7:00 AM email digest with the same "today" list — **not yet sending** (Phase 8 is partial, see PROJECT_SPEC.md §12: the schedule/preference exists, nothing dispatches it yet).
4. The same page is what Admin sees too — Admin's view is unscoped (whole portfolio); a lawyer's is scoped to matters they lead/support. There is no separate Admin dashboard design.

---

## 6. Working a case — the Case Page

**Opening a case — what the lawyer sees in the first 30 seconds:**
(Visual reference: `docs/design/case-page.html`.)
1. Header: title, reference, court no., ECCMIS no., court, status, priority, confidentiality lock chip, team avatars; buttons Add event · Upload · **Move stage** · ⋯ (Schedule hearing, Add deadline, New application, Reassign, Put on hold, Request closure *(not yet built — Phase 10)*).
2. Lifecycle tracker: where the case is now, "Stage X of Y · N days open"; click a stage → dates + key events in it; sub-processes as branches underneath.
3. **Overview** panel (renamed from "Case in 30 seconds", 2026-10-01): status banner + intake read-back (how it came in, parties, service/process, court & forum, representation), then summary (What it's about · Where it stands · What's next) + pinned messages. Right column: Key facts (next date & purpose, amount, UCAA role, judge, opposing counsel, category, last activity) · Deadlines · Team.
4. Tabs: Timeline · Legal Documents · Deadlines · Tasks · Discussion · Notes · Activity. (Parties CRUD lives in the Overview panel, not its own tab — see PROJECT_SPEC.md §5.7.)

**Everyday actions (all logged 📝, all update "last activity"):**

| Action | Steps | Automatic effects |
|---|---|---|
| **Add event** | + Add event → type (filing, correspondence, ruling, …) → date, description, attach documents | Added to timeline; ⚙️ if a Deadline Rule matches the event type, the system **suggests** a deadline (e.g. judgment logged → suggests "Notice of appeal due in N days"); lawyer confirms or dismisses |
| **Schedule hearing** | + Hearing → date/time, court, courtroom, purpose | On calendars of all assigned lawyers; clash check. Time-based reminders (7/1-day/morning-of) are **not yet sent** — see note below. |
| **Add deadline** | + Deadline → title, due date, critical?, assignee | Calendar entry created; 7/3/1-day/overdue reminders are **not yet sent** — see note below. |
| **Add task** | + Task → title, assignee, due | Assignee's task list + calendar |
| **Write note** | Notes → shared or private | Private visible only to author + Admin |
| **Edit summary** | Overview panel → Edit | Previous versions kept |
| **Upload document** | See flow 9 | |
| **Message team** | See flow 10 | |

> **Reminder sending status (2026-10-11):** every reminder "scheduled" above means a `CalendarEntry`/`Task` row exists with the right date — the in-app bell fires immediately for direct events (assignment, upload, mention, task-assigned), but nothing yet wakes up *later* to send the 7/3/1-day and overdue reminders described in flow 12, or the hearing-outcome escalation in flow 7 step 5. That needs a job runner and is the rest of Phase 8 (PROJECT_SPEC.md §12).

---

## 7. Hearing lifecycle (before → day → after)

1. ⚙️ 7 days before, 1 day before, morning of: 🔔 reminders with purpose, court, courtroom and a link to the (Later, v2) ✨ hearing prep sheet.
2. Hearing day happens (outside the system).
3. ⚙️ After the hearing time passes, the entry turns into **"Record outcome"** on My Day, the calendar and the case page.
4. 🟩 Lawyer records outcome:
   - **Proceeded** → notes; optional next date
   - **Adjourned** → reason (judge absent, counsel absent, pending mediation…) + **next date** (creates the next hearing automatically)
   - **Ruling/Judgment delivered** → outcome summary, attach the ruling → ⚙️ suggests stage move and matching deadlines (e.g. appeal window)
   - **Mention / directions given** → directions as tasks with due dates
5. ⚙️ Not recorded by next morning → 🔔 reminder to lead lawyer; after 3 days → 🔔 Admin.

```mermaid
flowchart TD
    H[Hearing scheduled] --> R1[Reminders 7d / 1d / morning]
    R1 --> D[Hearing time passes]
    D --> RO{Outcome recorded?}
    RO -- No, next morning --> N1[Remind lead lawyer]
    N1 -- 3 days --> N2[Escalate to Admin]
    RO -- Yes --> T{Outcome type}
    T -- Adjourned --> NX[Create next hearing with reason]
    T -- Proceeded --> NT[Notes + optional next date]
    T -- Ruling / Judgment --> J[Attach ruling → suggest stage move + deadlines]
    T -- Directions --> TK[Create tasks from directions]
```

---

## 8. Moving through the lifecycle

1. 🟩 Lawyer clicks **Move stage** (or accepts a system suggestion).
2. Picks next stage (normally the next one; can skip forward or go back — going back requires a reason).
3. ⚙️ If the stage template has **required fields** (e.g. "Filed & Served" requires filing date + service date), the form asks for them.
4. ⚙️ Timeline event "Moved from *Pleadings* to *Mediation*", tracker updates, 🔔 team + Admin. 📝
5. ⚙️ Time spent in each stage is recorded → feeds the "average duration per stage" report.

**Sub-processes** (e.g. an injunction application inside a suit, or an appeal / execution / taxation of costs after judgment): ⋯ → **New application** → pick the sub-process template → its own mini-lifecycle (e.g. Filed → Heard → Ruling) shown as a small branch under the main tracker; its hearings and deadlines appear on the calendar like any other.

**Changing matter type** (🟦 Admin): e.g. a pre-suit debt recovery becomes a suit → ⋯ → Change matter type → map current stage to a stage in the new lifecycle → ⚙️ timeline event added; the case reference stays the same. 📝

---

## 9. Secure documents

**Upload**
1. 🟩 Documents tab → drag & drop (or Upload) → choose folder, tags, confidentiality (inherits case level by default).
2. ⚙️ Pipeline: check type & size → **virus scan** → compute SHA-256 → encrypt with a per-file key → store privately → extract text for search → status "Ready". Infected or invalid files are rejected and 🔔 Admin alerted.
3. Same file name uploaded again → becomes **version 2** (old versions kept).
4. 📝 Upload logged. 🔔 team notified (batched: "3 new documents on *UCAA v. Nile Horizon Aviation Ltd*").

**View / download**
1. 🟩 Click document → ⚙️ permission check → opens in the **secure viewer** with watermark (name + date/time).
2. Download/print (if allowed for that confidentiality level) → watermarked copy, link valid ~60 s.
3. 📝 Every view, download, print is logged → visible to Admin in Activity.
4. ⚙️ Unusual activity (e.g. 50 downloads in 10 min) → 🔔 Admin + optional auto-lock of the account.

```mermaid
flowchart LR
    U[Upload] --> V{Type & size OK?}
    V -- No --> X[Reject]
    V -- Yes --> S{Virus scan}
    S -- Infected --> X2[Quarantine + alert Admin]
    S -- Clean --> HSH[SHA-256 hash] --> ENC[Encrypt per-file key] --> ST[(Private storage)]
    ST --> IDX[Extract text for search] --> RDY[Ready]
    RDY --> VW[View request] --> PC{Permission?}
    PC -- No --> DEN[403 + log]
    PC -- Yes --> WM[Watermarked viewer] --> LOG[Access log]
```

**Delete:** only soft delete; Admin can restore within the retention period. Nothing linked as evidence to a timeline event can be deleted without Admin.

---

## 10. Case discussion (chat)

1. 🟩 Discussion tab → type message; `@name` to mention; attach a document from the case (not from outside — keeps files inside the secure store); reply in thread.
2. ⚙️ Delivered live to anyone viewing the case; 🔔 mentioned users + team (email only if unread after 10 min, to avoid spam).
3. 🟩 **Pin** important messages (e.g. "Client agreed to settlement range X") → pinned bar at top of the tab, also shown in the catch-up panel.
4. Edit/delete own message within 15 min (shows "edited"); deleted messages remain in the audit log.
5. Only assigned lawyers + Admin can see or post. Closed case → chat read-only.

> **Status (2026-11-07):** steps 1–5 are built, including reply-in-thread, edit (15 min, "edited" label), pinned bar, unread counts with a "New messages" divider, and live in-app notifications for every new message (collapsed per case). **Not built:** the email for messages still unread after 10 minutes — it needs the background job runner (see PROJECT_SPEC §12 Phase 8).

---

## 11. Calendar

1. 🟩 **My Calendar**: every hearing, deadline, task, mediation, judgment date from my cases — generated automatically. Views: Month / Week / Day / Agenda.
2. Click an entry → side panel: what the date holds (case, type, court & courtroom, purpose, what to prepare: linked tasks & documents) → **Open case** or **Record outcome** (if past).
3. Add a personal entry (leave, training) → visible to Admin as availability.
4. ⚙️ Clash warning if two hearings overlap.
5. 🟦 **Department Calendar**: all lawyers, colour per lawyer, filters by lawyer/court/category; used when assigning cases and covering for absent lawyers ("Who can attend this hearing?").
6. Subscribe (.ics) → phone/Outlook shows reference + time only (no confidential details, by default).

---

## 12. Notifications

> **Partially built (2026-10-11 — see PROJECT_SPEC.md §12 Phase 8).** The left-hand "event happens" triggers below (assignment, upload, mention, task-assigned) are real and fire today. The "date approaching" triggers — hearing 7/1-day/morning-of, deadline 7/3/1-day + overdue, hearing-no-outcome escalation, cert-expiry, the morning digest — need something to notice time passing with no user action, which doesn't exist yet (no job runner). The rule/preference data model is fully built and ready for it.

```mermaid
flowchart LR
    EV[Event happens<br/>assignment, date approaching,<br/>message, upload, stage change] --> RULE{Notification rule}
    RULE --> INAPP[In-app bell - always]
    RULE --> EMAIL{Email?}
    EMAIL -- critical --> SEND[Send now]
    EMAIL -- normal --> BATCH[Batch / only if unread]
    RULE --> DIG[Morning digest]
```

- Bell panel: grouped by Today / Earlier, filter Unread / Mentions / Deadlines; click → deep link; "Mark all read".
- Preferences: user can mute non-critical types; hearings, deadlines and security alerts can't be muted.
- 🟦 Admin edits rules & reminder offsets in Settings.

---

## 13. Closing a case

> **Not yet built (2026-10-11) — this is Phase 10.** No `ClosureRequest` model exists; `/closure-requests` (Matter Closure Requests) is a placeholder, and the case header's ⋯ menu has no working "Request closure" action. The flow below is the target design, unchanged from the original spec.

1. ⚙️ **Close** button only appears when the case is at a stage the lifecycle marks as closable.
2. 🟩 Lead lawyer → **Request closure** → outcome, closing note (what happened, lessons learned), final amounts (awarded / paid / recovered / costs), attach final order.
3. ⚙️ Checklist blocks the request if: open deadlines, open tasks, or hearings without outcomes → lawyer resolves or marks N/A with reason.
4. ⚙️ Status → *Closure requested*; 🔔 Admin.
5. 🟦 Admin reviews in **Closure requests** → **Approve** (case → Closed, read-only, removed from active lists/calendars) or **Return** with comment (🔔 lawyer, case back to Open).
6. (If the Admin set the policy "lawyer can close" for that matter type, step 5 is skipped.)
7. **Reopen:** 🟦 Admin → Reopen → reason (e.g. appeal filed by other side) → back to chosen stage. 📝

```mermaid
stateDiagram-v2
    [*] --> Open
    Open --> OnHold: pause (reason)
    OnHold --> Open
    Open --> ClosureRequested: lawyer requests\n(closable stage + checklist ok)
    ClosureRequested --> Open: Admin returns
    ClosureRequested --> Closed: Admin approves
    Open --> Closed: policy allows lawyer to close
    Closed --> Open: Admin reopens (reason)
```

---

## 14. Case list — finding things

1. Filters bar: status, stage, category, type, court, lawyer, priority, UCAA role, value range.
2. Time filter: **Today · This week · This month · This quarter · This year · Custom** + choose date field (Opened / Closed / Next hearing / Last activity).
3. Sort by any column; toggle table / cards.
4. Save as a view ("My high-priority land cases") → appears in sidebar.
5. Export current results → Excel / PDF.
6. ⌘K global search anywhere → cases, parties, documents (incl. text inside), messages — only what the user may see.

---

## 15. Reports (Admin)

> **Not yet built (2026-10-11) — this is Phase 11.** "Legal Reports & Analytics" in the nav is a placeholder; the shared dashboard (flow 5) covers the KPI/overview view but not this module's filtered reports, drill-down or scheduled exports.

1. 🟦 Reports → pick a report (Case register, Outcomes, Workload, Exposure, Durations, Overdue, Inactive, Upcoming hearings).
2. Apply filters + time range + sort (same controls as case list).
3. View chart + table → click a bar/segment → drill down into those exact cases.
4. Export Excel / CSV / PDF (branded, "Confidential", generated-by + timestamp). 📝 exports are logged.
5. **Schedule** → e.g. "Case register, 1st of every month, to Head of Legal".

---

## 16. Import (Admin) — matters/cases

> **Not yet built (2026-10-11) — this is Phase 12.** `/import` is a placeholder. Don't confuse with the already-working *user* import at Users & Access → Import (template, mapping, preview, create, 24h rollback) — that one exists and follows this same flow shape; this flow is the case-import equivalent, still to be built.

```mermaid
flowchart LR
    T[Download template] --> F[Fill in Excel]
    F --> UP[Upload]
    UP --> MAP[Map columns<br/>auto + manual]
    MAP --> VAL[Validate & preview<br/>errors highlighted]
    VAL --> FIX{Errors?}
    FIX -- Fix inline or re-upload --> VAL
    FIX -- Import valid rows --> IMP[Create cases, parties,<br/>assignments, dates]
    IMP --> SUM[Summary + error report]
    SUM -. within 24h .-> RB[Rollback batch]
```

- Unknown lawyer emails, categories or courts → Admin can map them to existing ones or create them on the spot.
- Imported cases get a timeline event "Imported on DATE from FILE" and start at the stage given in the file.
- Also: bulk user import, bulk document upload (zip → folders).

---

## 17. Admin Settings changes (safe by design)

1. 🟦 Edit a category / stage / rule → preview of impact ("Used by 34 open cases").
2. Rename → applies everywhere. **Deactivate** → hidden for new cases, kept on existing ones. Hard delete only if never used.
3. Lifecycle edits → apply to new cases; option "Also update open cases" with a mapping of old → new stages.
4. Security settings changes require password re-entry. 📝 everything.

---

## 18. AI assistant (Later, v2 — build phase 14; Admin switch)

1. 🟦 Admin enables AI and chooses features; can exclude Highly Confidential cases.
2. 🟩 On a case: **✨ Catch me up** → ⚙️ builds context from timeline, notes, hearing outcomes, pinned messages (only what this user can access) → summary: what it's about · where it stands · what's next · risks.
3. 🟩 **Draft summary** → proposed text appears in the editor, marked "AI draft" → lawyer edits and saves (never auto-published).
4. 🟩 **Ask this case** → question → answer with citations linking to document + page.
5. 🟩 **Hearing prep sheet** from the hearing panel → one-page printable brief.
6. ⚙️ My Day ✨ weekly briefing.
7. 📝 Every AI use logged (who, which case, which feature).

---

## 19. Session end & safety

- Log out → session destroyed everywhere on that device.
- Admin → Users → lawyer → **Sign out all sessions** (e.g. lost laptop).
- Lost 2FA device → Admin resets 2FA → lawyer sets it up again at next login. 📝
