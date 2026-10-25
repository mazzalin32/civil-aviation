/**
 * Seed — idempotent, safe to re-run. Grows each phase (PROJECT_SPEC.md §12).
 * Deliberately self-contained: no import of src/lib/* here, since those files are
 * marked "server-only" and throw when loaded outside a Next.js server context.
 *
 * Phase 1: the Admin and sample lawyers get the development seed password;
 * each lawyer also gets a live activation link, emailed via Mailpit — check
 * http://localhost:8026 after running this, or read the link printed below.
 * Phase 2: Admin Settings reference data (categories, matter types & lifecycle
 * stages, forums, event/document types, outcomes, reminder rules) — spec §5.13.
 * Phase 4: 15 realistic cases across every matter type and lawyer, the mockup case
 * (docs/design/case-page.html) among them, matched by reference so re-running the
 * seed never creates duplicates.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import nodemailer from "nodemailer";
import { PrismaClient, Role, AssignmentRole, PartyKind, ContractStatusCategory, ContractExecutionStatus } from "../src/generated/prisma/client";

// Reimplemented here rather than imported from src/lib/documents/* — those are "server-only"
// and throw outside a Next.js server context (this is a plain tsx script). Same envelope
// AES-256-GCM scheme as src/lib/documents/encryption.ts, so the real download route can
// decrypt whatever this seeds.
function seedEncryptFile(plaintext: Buffer) {
  const masterKey = Buffer.from(process.env.DOCUMENT_MASTER_KEY!, "base64");
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const keyIv = crypto.randomBytes(12);
  const keyCipher = crypto.createCipheriv("aes-256-gcm", masterKey, keyIv);
  const wrappedKey = Buffer.concat([keyCipher.update(dataKey), keyCipher.final()]);
  const keyAuthTag = keyCipher.getAuthTag();
  const encryptedDataKey = Buffer.concat([keyIv, keyAuthTag, wrappedKey]).toString("base64");

  return { ciphertext, encryptedDataKey, iv: iv.toString("base64"), authTag: authTag.toString("base64") };
}

async function seedPutObject(key: string, data: Buffer) {
  const root = path.resolve(process.env.DOCUMENT_STORAGE_DIR ?? "./storage/documents");
  const full = path.resolve(root, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const mail = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1026),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
});
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const demoPassword = process.env.DEMO_LOGIN_PASSWORD?.trim();
const SEED_PASSWORD = demoPassword || process.env.SEED_PASSWORD || "pass123";

const monthsFromNow = (months: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

// Multi-tenancy foundation (2026-10-25) — CAA is the only real organisation today; Superadmin
// is the platform-level account (belongs to no organisation) that creates/brands organisations
// and invites their first Admin.
const ORGANIZATION_NAME = "Uganda Civil Aviation Authority";
const ORGANIZATION_DEFAULTS = { logoUrl: "/CAA-Uganda-logo-1.png", primaryColor: "#4169E1" };

const superadmin = {
  email: process.env.SEED_SUPERADMIN_EMAIL ?? "owner@caa-legal.app",
  name: process.env.SEED_SUPERADMIN_NAME ?? "Platform Owner",
  role: Role.SUPERADMIN,
  mustChangePassword: false,
};

const admin = {
  email: process.env.SEED_ADMIN_EMAIL ?? "head.legal@caa.go.ug",
  name: process.env.SEED_ADMIN_NAME ?? "Head of Legal",
  role: Role.ADMIN,
  title: "Director Legal Services",
  department: "Legal",
  mustChangePassword: false,
};

// Sample lawyers for development and demos — replace with real accounts via Users (Phase 3) or Import (Phase 12).
const lawyers = [
  { name: "Agnes Nakato", email: "agnes.nakato@caa.go.ug", title: "Senior Legal Officer", certMonths: 14 },
  { name: "Brian Okello", email: "brian.okello@caa.go.ug", title: "Legal Officer", certMonths: 1 }, // expiring soon → exercises cert alerts
  { name: "Carol Atim", email: "carol.atim@caa.go.ug", title: "Legal Officer", certMonths: 9 },
  { name: "David Ssemwogerere", email: "david.ssemwogerere@caa.go.ug", title: "Principal Legal Officer", certMonths: 20 },
];

// --- Phase 2: Admin Settings defaults (spec §5.13, §6) ---

const CATEGORIES = [
  "Debt Recovery",
  "Contracts & Commercial",
  "Employment",
  "Procurement",
  "Land & Property",
  "Regulatory & Licensing",
  "Compensation & Torts",
  "Judicial Review",
  "Criminal / Prosecution",
].map((name, i) => ({ name, color: i % 2 === 0 ? "neutral" : "primary", order: i }));

type StageSeed = { name: string; description?: string; allowsClosure?: boolean };
const MATTER_TYPES: {
  name: string;
  referencePrefix?: string;
  isSubProcess?: boolean;
  stages: StageSeed[];
}[] = [
  {
    name: "Civil litigation",
    referencePrefix: "LIT",
    stages: [
      { name: "Matter Intake" },
      { name: "Pre-action", description: "Demand letter / statutory notice" },
      { name: "Filed and Served" },
      { name: "Pleadings", description: "Ends when pleadings close" },
      { name: "Mediation", allowsClosure: true },
      { name: "Scheduling conference" },
      { name: "Hearing Stage" },
      { name: "Submissions" },
      { name: "Judgment", description: "Judgment or ruling" },
      { name: "Post-judgment", description: "Appeal, execution or taxation of costs run as sub-processes", allowsClosure: true },
      { name: "Closed", allowsClosure: true },
    ],
  },
  {
    name: "Tribunal proceedings",
    referencePrefix: "TRIB",
    stages: [
      { name: "Application Filed" },
      { name: "Response" },
      { name: "Hearing Stage" },
      { name: "Judgment / Ruling", allowsClosure: true },
      { name: "Appeal", allowsClosure: true },
      { name: "Closed", allowsClosure: true },
    ],
  },
  {
    name: "Arbitration / ADR",
    referencePrefix: "ARB",
    stages: [
      { name: "Notice of Dispute" },
      { name: "Tribunal constituted" },
      { name: "Statements of case" },
      { name: "Hearing Stage" },
      { name: "Award", allowsClosure: true },
      { name: "Enforcement / challenge", allowsClosure: true },
      { name: "Closed", allowsClosure: true },
    ],
  },
  {
    name: "Regulatory enforcement",
    referencePrefix: "REG",
    stages: [
      { name: "Breach reported" },
      { name: "Legal Investigation" },
      { name: "Notice to operator" },
      { name: "Response" },
      { name: "Judgment / Ruling", allowsClosure: true },
      { name: "Appeal", allowsClosure: true },
      { name: "Closed", allowsClosure: true },
    ],
  },
  {
    name: "Debt recovery (pre-suit)",
    referencePrefix: "DR",
    stages: [
      { name: "Demand notice" },
      { name: "Negotiation / payment plan", allowsClosure: true },
      { name: "Recovered / written off", allowsClosure: true },
      { name: "Closed", allowsClosure: true },
    ],
  },
  {
    name: "Advisory",
    referencePrefix: "ADV",
    stages: [
      { name: "Request received" },
      { name: "Research" },
      { name: "Draft / Pre-Filing" },
      { name: "Head of Legal review" },
      { name: "Issued", allowsClosure: true },
      { name: "Closed", allowsClosure: true },
    ],
  },
  {
    name: "Interlocutory application",
    isSubProcess: true,
    stages: [{ name: "Filed" }, { name: "Heard" }, { name: "Ruling", allowsClosure: true }],
  },
  {
    name: "Appeal",
    isSubProcess: true,
    stages: [{ name: "Notice of appeal" }, { name: "Record of appeal" }, { name: "Hearing Stage" }, { name: "Judgment", allowsClosure: true }],
  },
  {
    name: "Execution",
    isSubProcess: true,
    stages: [{ name: "Application" }, { name: "Warrant issued" }, { name: "Recovered", allowsClosure: true }],
  },
  {
    name: "Taxation of costs",
    isSubProcess: true,
    stages: [{ name: "Bill filed" }, { name: "Taxation hearing" }, { name: "Certificate issued", allowsClosure: true }],
  },
];

// The Contract's overall lifecycle (client's "Contract lifecycle" vocab, 2026-10-15) — fully
// independent of Matter/StageTemplate since the Contracts register was restructured 2026-10-17
// to stand apart from Legal Matters. Receipt, legal review, internal approval, AG vetting,
// amendments and execution are tracked in parallel on the Contract itself, not as stages —
// see CONTRACT_STATUS_OPTIONS.
const CONTRACT_STAGES: { name: string; allowsClosure?: boolean }[] = [
  { name: "Not Yet Effective" },
  { name: "Active / In Force" },
  { name: "Suspended" },
  { name: "Renewal Under Consideration" },
  { name: "Expired", allowsClosure: true },
  { name: "Terminated", allowsClosure: true },
  { name: "Closed / Archived", allowsClosure: true },
];

const FORUMS: { name: string; level: string; division?: string }[] = [
  { name: "Supreme Court of Uganda", level: "SUPREME_COURT" },
  { name: "Court of Appeal of Uganda", level: "COURT_OF_APPEAL" },
  { name: "Constitutional Court of Uganda", level: "CONSTITUTIONAL_COURT" },
  { name: "High Court — Civil Division", level: "HIGH_COURT", division: "Civil" },
  { name: "High Court — Commercial Division", level: "HIGH_COURT", division: "Commercial" },
  { name: "High Court — Land Division", level: "HIGH_COURT", division: "Land" },
  { name: "High Court — Family Division", level: "HIGH_COURT", division: "Family" },
  { name: "High Court — Criminal Division", level: "HIGH_COURT", division: "Criminal" },
  { name: "High Court — Anti-Corruption Division", level: "HIGH_COURT", division: "Anti-Corruption" },
  { name: "High Court — International Crimes Division", level: "HIGH_COURT", division: "International Crimes" },
  { name: "Chief Magistrate's Court", level: "CHIEF_MAGISTRATE" },
  { name: "Magistrate Grade I", level: "MAGISTRATE_GI" },
  { name: "Industrial Court", level: "TRIBUNAL" },
  { name: "Tax Appeals Tribunal", level: "TRIBUNAL" },
  { name: "PPDA Appeals Tribunal", level: "TRIBUNAL" },
  { name: "CADER (Arbitration)", level: "ARBITRATION" },
  { name: "Ad hoc Arbitration", level: "ARBITRATION" },
  { name: "UCAA Internal Disciplinary Panel", level: "INTERNAL_PANEL" },
];

const EVENT_TYPES = ["Filing", "Correspondence", "Ruling", "Hearing", "Mediation session", "Judgment / order", "Application filed", "Directions", "Stage change", "Assignment change"];
const DOCUMENT_FOLDERS = ["Pleadings", "Evidence", "Correspondence", "Court Orders", "Submissions", "Internal Memos"];
const OUTCOMES = ["Won", "Lost", "Settled", "Withdrawn", "Dismissed", "Struck out", "Advice issued"];

const NOTIFICATION_RULES: { trigger: string; label: string; offsets: number[]; channels: string[]; mutable: boolean }[] = [
  { trigger: "HEARING_REMINDER", label: "Hearing coming up", offsets: [7, 1, 0], channels: ["IN_APP", "EMAIL"], mutable: false },
  { trigger: "DEADLINE_REMINDER", label: "Deadline coming up / overdue", offsets: [7, 3, 1, 0], channels: ["IN_APP", "EMAIL"], mutable: false },
  { trigger: "HEARING_OUTCOME_MISSING", label: "Hearing passed with no outcome recorded", offsets: [1, 3], channels: ["IN_APP", "EMAIL"], mutable: false },
  { trigger: "CASE_ASSIGNED", label: "Case assigned or reassigned to you", offsets: [0], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "TASK_ASSIGNED", label: "A task is assigned to you", offsets: [0], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "MESSAGE_MENTION", label: "New message or @mention", offsets: [0], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "DOCUMENT_UPLOADED", label: "Document uploaded to your case", offsets: [0], channels: ["IN_APP"], mutable: true },
  { trigger: "STAGE_OR_CLOSURE_CHANGED", label: "Stage changed / closure requested or approved", offsets: [0], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "CASE_INACTIVE", label: "Case inactive 30+ days", offsets: [30], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "CERT_EXPIRING", label: "Practising certificate expiring", offsets: [30], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "SUSPICIOUS_ACTIVITY", label: "Suspicious activity (mass download, failed logins)", offsets: [0], channels: ["EMAIL"], mutable: false },
];

// Illustrative starting points (spec §5.13/§5.7 example: "judgment logged → suggests Notice
// of appeal due in N days") — the Admin is expected to review and adjust actual limitation
// periods for their jurisdiction; nothing legal is hard-coded into the app itself (CLAUDE.md).
const DEADLINE_RULES: { trigger: string; title: string; offsetDays: number; isCritical: boolean }[] = [
  { trigger: "Judgment / order", title: "Notice of appeal due", offsetDays: 14, isCritical: true },
  { trigger: "Ruling", title: "Comply with ruling", offsetDays: 30, isCritical: false },
  { trigger: "Filing", title: "Awaiting response", offsetDays: 15, isCritical: false },
];

// Dropdown vocabulary for the Contracts register's five parallel tracking statuses
// (client feedback 2026-10-15) — Admin-configurable via ContractStatusOption, never hard-coded
// in the UI (CLAUDE.md). The contract's overall lifecycle is a sixth dimension, handled by the
// Contract matter type's ordinary StageTemplate lifecycle instead (see MATTER_TYPES above).
const CONTRACT_STATUS_OPTIONS: Record<ContractStatusCategory, string[]> = {
  RECEIPT: ["Awaiting Receipt", "Received", "Registration Pending", "Registered"],
  LEGAL_REVIEW: ["Not Commenced", "Under Legal Review", "Comments Issued", "Referred for Further Review", "Legal Review Completed"],
  INTERNAL_APPROVAL: ["Pending Approval", "Approved", "Approved Subject to Conditions", "Not Approved", "Approval Not Required"],
  AG_VETTING: [
    "Not Required",
    "Pending Submission",
    "Submitted for Vetting",
    "Acknowledgment Awaited",
    "Under Vetting",
    "Comments / Revisions Requested",
    "Resubmitted for Vetting",
    "Cleared / No Objection Recorded",
    "Vetting Outcome Pending Confirmation",
  ],
  AMENDMENTS: ["No Amendments Required", "Amendments Required", "Amendments in Progress", "Amended Draft Submitted", "Amendments Accepted"],
};

async function seedReferenceData() {
  for (const c of CATEGORIES) {
    await db.category.upsert({ where: { name: c.name }, update: {}, create: c });
  }

  for (const [i, mt] of MATTER_TYPES.entries()) {
    const created = await db.matterType.upsert({
      where: { name: mt.name },
      update: {},
      create: {
        name: mt.name,
        referencePrefix: mt.referencePrefix ?? null,
        isSubProcess: mt.isSubProcess ?? false,
        order: i,
      },
    });
    for (const [j, s] of mt.stages.entries()) {
      await db.stageTemplate.upsert({
        where: { matterTypeId_name: { matterTypeId: created.id, name: s.name } },
        update: { isActive: true },
        create: {
          matterTypeId: created.id,
          name: s.name,
          description: s.description ?? null,
          allowsClosure: s.allowsClosure ?? false,
          order: j,
        },
      });
    }
    // Deactivate (never delete — CLAUDE.md) stage names dropped from this matter type's lifecycle.
    const currentNames = mt.stages.map((s) => s.name);
    await db.stageTemplate.updateMany({ where: { matterTypeId: created.id, name: { notIn: currentNames } }, data: { isActive: false } });
  }
  // The old "Contract" matter type is superseded by the standalone Contract model (2026-10-17) —
  // deactivated rather than deleted (CLAUDE.md), so it drops out of every matter-type picker.
  await db.matterType.updateMany({ where: { name: "Contract" }, data: { isActive: false } });

  for (const [i, s] of CONTRACT_STAGES.entries()) {
    await db.contractStage.upsert({
      where: { name: s.name },
      update: { order: i, allowsClosure: s.allowsClosure ?? false, isActive: true },
      create: { name: s.name, order: i, allowsClosure: s.allowsClosure ?? false },
    });
  }

  for (const category of Object.keys(CONTRACT_STATUS_OPTIONS) as ContractStatusCategory[]) {
    for (const [i, label] of CONTRACT_STATUS_OPTIONS[category].entries()) {
      await db.contractStatusOption.upsert({ where: { category_label: { category, label } }, update: { order: i, isActive: true }, create: { category, label, order: i } });
    }
  }

  for (const [i, f] of FORUMS.entries()) {
    await db.forum.upsert({ where: { name: f.name }, update: {}, create: { ...f, order: i } });
  }
  for (const [i, name] of EVENT_TYPES.entries()) {
    await db.eventType.upsert({ where: { name }, update: {}, create: { name, order: i } });
  }
  for (const [i, name] of DOCUMENT_FOLDERS.entries()) {
    await db.documentFolder.upsert({ where: { name }, update: {}, create: { name, order: i } });
  }
  for (const [i, name] of OUTCOMES.entries()) {
    await db.outcome.upsert({ where: { name }, update: {}, create: { name, order: i } });
  }
  for (const r of NOTIFICATION_RULES) {
    await db.notificationRule.upsert({ where: { trigger: r.trigger }, update: {}, create: r });
  }
  for (const r of DEADLINE_RULES) {
    const eventType = await db.eventType.findUniqueOrThrow({ where: { name: r.trigger } });
    const existing = await db.deadlineRule.findFirst({ where: { title: r.title, triggerEventTypeId: eventType.id } });
    if (!existing) await db.deadlineRule.create({ data: { title: r.title, offsetDays: r.offsetDays, isCritical: r.isCritical, triggerEventTypeId: eventType.id } });
  }
}

// --- Phase 4: 15 realistic cases (spec §12), the mockup case (docs/design/case-page.html) among them ---

type CaseSeed = {
  title: string;
  categoryName: string;
  matterTypeName: string;
  stageName: string;
  ucaaRole: "PLAINTIFF" | "DEFENDANT" | "APPLICANT" | "RESPONDENT" | "ADVISOR" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status?: "OPEN" | "ON_HOLD" | "CLOSURE_REQUESTED" | "CLOSED";
  forumName?: string;
  courtCaseNo?: string;
  eccmisNo?: string;
  judge?: string;
  amountClaimed?: bigint;
  amountAgainst?: bigint;
  causeOfActionDate?: string;
  referralNote?: string;
  openedAt: string; // also drives the reference year
  lastActivityAt: string;
  closedAt?: string;
  leadEmail: string;
  supportEmails?: string[];
  opposing?: { name: string; counselName?: string; counselFirm?: string }[];
  sourceUrl?: string; // published judgment/ruling (e.g. ULII) for lawyers to read in full
};

const CASE_SEEDS: CaseSeed[] = [
  // Real, publicly reported CAA matters (ULII judgments) — added at the client's request as
  // relatable live examples rather than invented ones. Both already concluded.
  {
    title: "Kiiza Besigye v. Civil Aviation Authority & Anor",
    categoryName: "Compensation & Torts",
    matterTypeName: "Civil litigation",
    stageName: "Closed",
    status: "CLOSED",
    ucaaRole: "DEFENDANT",
    priority: "LOW",
    forumName: "High Court — Civil Division",
    courtCaseNo: "CS 732 of 2016",
    judge: "Hon. Justice Ssekaana Musa",
    amountAgainst: BigInt(300_000_000),
    causeOfActionDate: "2016-10-03",
    referralNote:
      "Constitutional petition after the plaintiff's arrest by Uganda Aviation Police at Entebbe Airport on return from travel; the Attorney General was joined as co-defendant over the conduct of the police. Judgment (15 Mar 2019): the arrest itself was justified but its manner violated Articles 23(3) and 24; the court found CAA not liable (airport security is the Uganda Police Force's responsibility, CAA's role being limited to reflector jackets/access clearance per ICAO SOPs) — the Attorney General was held liable instead and ordered to pay UGX 10,000,000 plus costs.",
    openedAt: "2016-11-15",
    lastActivityAt: "2019-03-15",
    closedAt: "2019-03-15",
    leadEmail: "david.ssemwogerere@caa.go.ug",
    opposing: [{ name: "Kizza Besigye Kifefe", counselFirm: "Rwakafuuzi & Co. Advocates" }],
    sourceUrl: "https://ulii.org/en/akn/ug/judgment/ughccd/2019/39/eng@2019-03-15",
  },
  {
    title: "Makuza v. Civil Aviation Authority & Anor",
    categoryName: "Employment",
    matterTypeName: "Civil litigation",
    stageName: "Closed",
    status: "CLOSED",
    ucaaRole: "RESPONDENT",
    priority: "LOW",
    forumName: "High Court — Civil Division",
    courtCaseNo: "MC 205 of 2017",
    judge: "Hon. Mr. Justice Stephen Musota",
    amountAgainst: BigInt(600_000_000),
    referralNote:
      "Judicial review application by CAA's former Managing Director challenging the Minister of Works and Transport's termination of his contract of service as illegal and ultra vires; sought declarations plus general and aggravated damages. Ruling (21 Dec 2017): preliminary objections upheld — struck out as disclosing no cause of action against CAA (the termination decision was the Minister's, not CAA's) and as improperly brought as Judicial Review when it was in substance an employment dispute that should have been an ordinary suit.",
    openedAt: "2017-06-01",
    lastActivityAt: "2017-12-21",
    closedAt: "2017-12-21",
    leadEmail: "carol.atim@caa.go.ug",
    opposing: [{ name: "Dr. Wenceslaus Rama Makuza", counselName: "Mr. Baku Raphael (holding brief for Mr. Rwaganika)" }],
    sourceUrl: "https://ulii.org/en/akn/ug/judgment/ughccd/2017/194/eng@2017-12-21",
  },
  {
    title: "Okalany v. Civil Aviation Authority & Anor",
    categoryName: "Employment",
    matterTypeName: "Civil litigation",
    stageName: "Closed",
    status: "CLOSED",
    ucaaRole: "RESPONDENT",
    priority: "LOW",
    forumName: "High Court — Civil Division",
    courtCaseNo: "MC 111 of 2015",
    judge: "Hon. Mr. Justice Stephen Musota",
    amountAgainst: BigInt(1_288_324_583),
    causeOfActionDate: "2015-06-16",
    referralNote:
      "John Okalany, former General Manager of Entebbe International Airport, sought judicial review after the Minister of Works and Transport directed his re-deployment while he was on sick leave; the Minister later withdrew the directive and the parties agreed Okalany would take early retirement, but disputed the retirement package. Ruling (14 Sep 2016): treated as a compromise of the suit rather than judgment on admission — the court entered a decree for the agreed, uncontested retirement benefits (gratuity, salary, long service award, air tickets, 13th cheque, certificate of service, repatriation), leaving three disputed items (rental refund, salary arrears, leave) to be claimed separately.",
    openedAt: "2015-08-01",
    lastActivityAt: "2016-09-14",
    closedAt: "2016-09-14",
    leadEmail: "carol.atim@caa.go.ug",
    opposing: [{ name: "John Okalany", counselName: "Prof. Barya & Mr. Deo Bitaguma" }],
    sourceUrl: "https://ulii.org/en/akn/ug/judgment/ughccd/2016/77/eng@2016-09-14",
  },
  {
    title: "Nsamba Michael v. Civil Aviation Authority & Anor",
    categoryName: "Land & Property",
    matterTypeName: "Civil litigation",
    stageName: "Scheduling conference",
    ucaaRole: "DEFENDANT",
    priority: "MEDIUM",
    forumName: "High Court — Land Division",
    courtCaseNo: "HCCS 471 of 2019",
    judge: "Hon. Justice Naluzze Aisha Batala",
    referralNote:
      "Land suit (HCCS 471 of 2019) brought against CAA and the Uganda Land Commission; dismissed for want of prosecution on 18 Apr 2023 after the plaintiff missed a hearing. Ruling on Misc. Application 791 of 2023 (10 Nov 2023): the dismissal was reviewed and set aside — the trial judge had dismissed under the wrong procedural rule and the plaintiff had in fact been represented by counsel — the suit is reinstated for hearing inter partes on its merits, each party bearing its own costs.",
    openedAt: "2019-05-01",
    lastActivityAt: "2023-11-10",
    leadEmail: "agnes.nakato@caa.go.ug",
    opposing: [{ name: "Nsamba Michael" }],
    sourceUrl: "https://ulii.org/en/akn/ug/judgment/ughcld/2023/363/eng@2023-11-10",
  },
];

/** Intake fields (9-step New case flow) derived from what each seed case already says, so sample cases look as if they came through the intake. */
function intakeFields(c: CaseSeed, leadId: string, matterTypeName: string) {
  const serving = c.ucaaRole === "PLAINTIFF" || c.ucaaRole === "APPLICANT";
  const served = c.ucaaRole === "DEFENDANT" || c.ucaaRole === "RESPONDENT";
  const opened = new Date(`${c.openedAt}T09:00:00Z`);
  return {
    description: c.referralNote ?? null,
    reportedAt: opened,
    reportedBy: "CAA department",
    reportMethod: "Internal memo",
    serviceDirection: serving ? ("CAA_SERVING" as const) : served ? ("CAA_SERVED" as const) : ("NOT_YET_SERVED" as const),
    processNature: matterTypeName === "Civil litigation" ? (served ? "Summons" : "Plaint") : null,
    legalRecipientId: leadId,
    courtStation: c.forumName ? "Kampala" : null,
    filedAt: c.courtCaseNo ? new Date(`${c.openedAt}T00:00:00Z`) : null,
    jurisdiction: matterTypeName === "Civil litigation" ? "Civil" : null,
    representationStatus: "In-house counsel",
  };
}

// --- Contracts register (fully independent of Matter/Legal Matters since 2026-10-17) ---

type ContractSeed = {
  title: string;
  categoryName: string;
  counterpartyName: string;
  stageName: string;
  originatingDepartment?: string;
  dateOfReceipt?: string;
  dateSubmittedForReview?: string;
  receiptStatus?: string;
  legalReviewStatus?: string;
  internalApprovalStatus?: string;
  agVettingStatus?: string;
  amendmentsStatus?: string;
  caaExecutionStatus?: ContractExecutionStatus;
  counterpartyExecutionStatus?: ContractExecutionStatus;
  dateOfSignature?: string;
  dateOfFullExecution?: string;
  commencementDate?: string;
  expiryDate?: string;
  outstandingAction?: string;
  leadEmail: string;
};

const CONTRACT_SEEDS: ContractSeed[] = [
  {
    title: "Ground handling services agreement — SkyLink Aviation Services",
    categoryName: "Contracts & Commercial",
    counterpartyName: "SkyLink Aviation Services Ltd",
    stageName: "Active / In Force",
    originatingDepartment: "Airport Operations",
    dateOfReceipt: "2026-04-02",
    dateSubmittedForReview: "2026-04-05",
    receiptStatus: "Registered",
    legalReviewStatus: "Legal Review Completed",
    internalApprovalStatus: "Approved",
    agVettingStatus: "Cleared / No Objection Recorded",
    amendmentsStatus: "No Amendments Required",
    caaExecutionStatus: ContractExecutionStatus.SIGNED,
    counterpartyExecutionStatus: ContractExecutionStatus.SIGNED,
    dateOfSignature: "2026-05-18",
    dateOfFullExecution: "2026-05-20",
    commencementDate: "2026-06-01",
    expiryDate: "2029-05-31",
    leadEmail: "agnes.nakato@caa.go.ug",
  },
  {
    title: "Fuel supply agreement renewal — Meridian Fuel Supplies Ltd",
    categoryName: "Contracts & Commercial",
    counterpartyName: "Meridian Fuel Supplies Ltd",
    stageName: "Not Yet Effective",
    originatingDepartment: "Finance",
    dateOfReceipt: "2026-08-14",
    dateSubmittedForReview: "2026-08-18",
    receiptStatus: "Registered",
    legalReviewStatus: "Comments Issued",
    internalApprovalStatus: "Pending Approval",
    agVettingStatus: "Not Required",
    amendmentsStatus: "Amendments Required",
    caaExecutionStatus: ContractExecutionStatus.PENDING,
    counterpartyExecutionStatus: ContractExecutionStatus.PENDING,
    outstandingAction: "Awaiting the supplier's amended pricing-review clause before resubmitting for internal approval.",
    leadEmail: "carol.atim@caa.go.ug",
  },
];

/** Looks up each ContractStatusOption label and returns the Contract upsert payload
 * (Prisma's generated connect/scalar input types aren't worth importing into this
 * self-contained script, so the data shape is left to infer). */
async function resolveContractStatuses(c: ContractSeed) {
  const statusId = async (category: ContractStatusCategory, label?: string) =>
    label ? (await db.contractStatusOption.findUniqueOrThrow({ where: { category_label: { category, label } } })).id : null;

  const [receiptStatusId, legalReviewStatusId, internalApprovalStatusId, agVettingStatusId, amendmentsStatusId] = await Promise.all([
    statusId(ContractStatusCategory.RECEIPT, c.receiptStatus),
    statusId(ContractStatusCategory.LEGAL_REVIEW, c.legalReviewStatus),
    statusId(ContractStatusCategory.INTERNAL_APPROVAL, c.internalApprovalStatus),
    statusId(ContractStatusCategory.AG_VETTING, c.agVettingStatus),
    statusId(ContractStatusCategory.AMENDMENTS, c.amendmentsStatus),
  ]);

  return {
    originatingDepartment: c.originatingDepartment ?? null,
    dateOfReceipt: c.dateOfReceipt ? new Date(c.dateOfReceipt) : null,
    dateSubmittedForReview: c.dateSubmittedForReview ? new Date(c.dateSubmittedForReview) : null,
    receiptStatusId,
    legalReviewStatusId,
    internalApprovalStatusId,
    agVettingStatusId,
    amendmentsStatusId,
    caaExecutionStatus: c.caaExecutionStatus ?? ContractExecutionStatus.PENDING,
    counterpartyExecutionStatus: c.counterpartyExecutionStatus ?? ContractExecutionStatus.PENDING,
    dateOfSignature: c.dateOfSignature ? new Date(c.dateOfSignature) : null,
    dateOfFullExecution: c.dateOfFullExecution ? new Date(c.dateOfFullExecution) : null,
    commencementDate: c.commencementDate ? new Date(c.commencementDate) : null,
    expiryDate: c.expiryDate ? new Date(c.expiryDate) : null,
    outstandingAction: c.outstandingAction ?? null,
  };
}

async function seedContracts(lawyersByEmail: Map<string, string>, adminId: string, organizationId: string) {
  for (const c of CONTRACT_SEEDS) {
    const existing = await db.contract.findFirst({ where: { title: c.title } });
    const category = await db.category.findUniqueOrThrow({ where: { name: c.categoryName } });
    const stage = await db.contractStage.findUniqueOrThrow({ where: { name: c.stageName } });
    const statuses = await resolveContractStatuses(c);
    const leadId = lawyersByEmail.get(c.leadEmail)!;

    if (existing) {
      await db.contract.update({ where: { id: existing.id }, data: { ...statuses, currentStageId: stage.id } });
      continue;
    }

    const prefix = "CTR";
    const year = new Date().getUTCFullYear();
    const count = await db.contract.count({ where: { reference: { startsWith: `UCAA/${prefix}/${year}/` } } });
    const number = count + 1;
    const reference = `UCAA/${prefix}/${year}/${String(number).padStart(4, "0")}`;
    // Keep the shared counter ahead so the live wizard's next real contract this year doesn't collide.
    const counter = await db.referenceCounter.findUnique({ where: { prefix_year: { prefix, year } } });
    await db.referenceCounter.upsert({
      where: { prefix_year: { prefix, year } },
      update: { next: Math.max(number + 1, counter?.next ?? 1) },
      create: { prefix, year, next: number + 1 },
    });

    const contract = await db.contract.create({
      data: {
        reference,
        organizationId,
        title: c.title,
        categoryId: category.id,
        counterpartyName: c.counterpartyName,
        currentStageId: stage.id,
        createdById: adminId,
        ...statuses,
      },
    });
    await db.contractAssignment.create({ data: { contractId: contract.id, userId: leadId, role: AssignmentRole.LEAD, assignedById: adminId } });
  }
}

async function seedCases(lawyersByEmail: Map<string, string>, adminId: string, organizationId: string) {
  const referenceCounters = new Map<string, number>(); // `${prefix}:${year}` -> next number to use

  for (const c of CASE_SEEDS) {
    const [category, matterType, forum] = await Promise.all([
      db.category.findUniqueOrThrow({ where: { name: c.categoryName } }),
      db.matterType.findUniqueOrThrow({ where: { name: c.matterTypeName } }),
      c.forumName ? db.forum.findUniqueOrThrow({ where: { name: c.forumName } }) : Promise.resolve(null),
    ]);
    const stage = await db.stageTemplate.findFirstOrThrow({ where: { matterTypeId: matterType.id, name: c.stageName } });

    const prefix = matterType.referencePrefix!;
    const year = new Date(c.openedAt).getUTCFullYear();
    const key = `${prefix}:${year}`;
    const number = referenceCounters.get(key) ?? 1;
    referenceCounters.set(key, number + 1);
    const reference = `UCAA/${prefix}/${year}/${String(number).padStart(4, "0")}`;

    const leadId = lawyersByEmail.get(c.leadEmail)!;
    const createdAt = new Date(`${c.openedAt}T09:00:00Z`);

    const existing = await db.matter.findUnique({ where: { reference } });
    if (existing) {
      // Idempotent re-run — the case itself is never edited by the seed, but a later phase's
      // demo content (e.g. Phase 5's timeline/summary/note) may still need to be added.
      // Backfill intake fields on cases seeded before the 9-step intake existed (only where still empty).
      await db.matter.updateMany({ where: { id: existing.id, reportedAt: null }, data: intakeFields(c, leadId, c.matterTypeName) });
      // Migrate a matter onto a renamed/replaced stage so it doesn't keep pointing at a deactivated one.
      if (existing.currentStageId !== stage.id) {
        await db.matter.update({ where: { id: existing.id }, data: { currentStageId: stage.id } });
        await db.matterStage.create({ data: { matterId: existing.id, stageTemplateId: stage.id, movedById: adminId, note: "Migrated onto the current lifecycle" } });
      }
      if (c.sourceUrl && existing.sourceUrl !== c.sourceUrl) {
        await db.matter.update({ where: { id: existing.id }, data: { sourceUrl: c.sourceUrl } });
      }
      continue;
    }

    const matter = await db.matter.create({
      data: {
        reference,
        organizationId,
        title: c.title,
        categoryId: category.id,
        matterTypeId: matterType.id,
        ucaaRole: c.ucaaRole,
        priority: c.priority,
        status: c.status ?? "OPEN",
        currentStageId: stage.id,
        forumId: forum?.id ?? null,
        courtCaseNo: c.courtCaseNo ?? null,
        eccmisNo: c.eccmisNo ?? null,
        judge: c.judge ?? null,
        amountClaimed: c.amountClaimed ?? null,
        amountAgainst: c.amountAgainst ?? null,
        causeOfActionDate: c.causeOfActionDate ? new Date(c.causeOfActionDate) : null,
        referralNote: c.referralNote ?? null,
        sourceUrl: c.sourceUrl ?? null,
        ...intakeFields(c, leadId, c.matterTypeName),
        createdById: adminId,
        createdAt,
        lastActivityAt: new Date(`${c.lastActivityAt}T09:00:00Z`),
        closedAt: c.closedAt ? new Date(`${c.closedAt}T09:00:00Z`) : null,
        closedById: c.closedAt ? adminId : null,
      },
    });

    await db.matterStage.create({ data: { matterId: matter.id, stageTemplateId: stage.id, movedById: adminId, enteredAt: createdAt, note: "Case opened" } });
    await db.matterAssignment.create({ data: { matterId: matter.id, userId: leadId, role: AssignmentRole.LEAD, assignedById: adminId, assignedAt: createdAt } });
    for (const email of c.supportEmails ?? []) {
      await db.matterAssignment.create({ data: { matterId: matter.id, userId: lawyersByEmail.get(email)!, role: AssignmentRole.SUPPORT, assignedById: adminId, assignedAt: createdAt } });
    }
    for (const p of c.opposing ?? []) {
      await db.party.create({ data: { matterId: matter.id, name: p.name, kind: PartyKind.OPPOSING, counselName: p.counselName ?? null, counselFirm: p.counselFirm ?? null } });
    }
  }

  // Keep the shared counter ahead of every number this seed used, so the wizard's next
  // real case this year doesn't collide with a seeded reference. Never move it backwards —
  // a real case created between seed runs may have already advanced it further.
  for (const [key, nextNumber] of referenceCounters) {
    const [prefix, yearStr] = key.split(":");
    const year = Number(yearStr);
    const current = await db.referenceCounter.findUnique({ where: { prefix_year: { prefix, year } } });
    const next = Math.max(current?.next ?? 1, nextNumber);
    await db.referenceCounter.upsert({
      where: { prefix_year: { prefix, year } },
      update: { next },
      create: { prefix, year, next },
    });
  }
}

/** A few Law Firms / Links / a group chat message so the pitch prototype's newer pages
 *  (org-wide, not tied to a matter) aren't empty on a fresh seed. Guarded by name/title
 *  so reseeding doesn't duplicate them. */
async function seedPitchExtras(adminId: string, firstLawyerId: string) {
  const firms: { name: string; contactName: string; phone: string; email: string }[] = [
    { name: "Katende, Ssempebwa & Co. Advocates", contactName: "Ms. Harriet Nabirye", phone: "+256 414 342 634", email: "info@ksadvocates.co.ug" },
    { name: "MMAKS Advocates", contactName: "Mr. Timothy Kanyerezi", phone: "+256 417 701 000", email: "info@mmaks.co.ug" },
  ];
  for (const f of firms) {
    const existing = await db.lawFirm.findFirst({ where: { name: f.name } });
    if (!existing) await db.lawFirm.create({ data: { ...f, addedById: adminId } });
  }

  const links: { title: string; url: string; category: string }[] = [
    { title: "The Judicature Act", url: "https://ulii.org/akn/ug/act/1996/13", category: "Statutes" },
    { title: "Civil Procedure Rules", url: "https://ulii.org/akn/ug/act/si/1971/48", category: "Statutes" },
    { title: "Judiciary e-Filing (ECCMIS)", url: "https://eccmis.judiciary.go.ug", category: "Court portals" },
    { title: "Uganda Legal Information Institute (ULII)", url: "https://ulii.org", category: "Legal research" },
    { title: "International Civil Aviation Organization (ICAO)", url: "https://www.icao.int", category: "Aviation" },
    { title: "Google", url: "https://www.google.com", category: "Tools" },
    { title: "WhatsApp Web", url: "https://web.whatsapp.com", category: "Tools" },
    { title: "Uganda Registration Services Bureau (URSB)", url: "https://ursb.go.ug", category: "Government" },
    { title: "Uganda Revenue Authority (URA)", url: "https://ura.go.ug", category: "Government" },
  ];
  for (const l of links) {
    const existing = await db.resourceLink.findFirst({ where: { title: l.title } });
    if (!existing) await db.resourceLink.create({ data: { ...l, addedById: adminId } });
  }

  const groupMessageCount = await db.groupMessage.count();
  if (groupMessageCount === 0) {
    await db.groupMessage.create({
      data: { authorId: firstLawyerId, body: "Welcome to the department group chat — post updates that affect everyone here." },
    });
  }

  // A few real documents (encrypted + written to disk, same as a live upload) so the
  // Documents library shows what a document actually looks like, not an empty state.
  const documentCount = await db.document.count();
  if (documentCount === 0 && process.env.DOCUMENT_MASTER_KEY) {
    const sampleMatters = await db.matter.findMany({ take: 3, orderBy: { createdAt: "asc" }, select: { id: true } });
    const folderByName = new Map((await db.documentFolder.findMany({ select: { id: true, name: true } })).map((f) => [f.name, f.id]));
    // .txt + text/plain (not .pdf) so "View" actually opens correctly instead of a
    // mismatched-mimetype preview — the list only ever shows a generic file icon anyway.
    const samples: { matterIndex: number; folder: string; name: string; body: string }[] = [
      { matterIndex: 0, folder: "Pleadings", name: "Plaint.txt", body: "Sample plaint document — pitch prototype placeholder content." },
      { matterIndex: 0, folder: "Evidence", name: "Witness statement - A. Nakato.txt", body: "Sample witness statement — pitch prototype placeholder content." },
      { matterIndex: 1, folder: "Correspondence", name: "Letter to opposing counsel.txt", body: "Sample correspondence — pitch prototype placeholder content." },
      { matterIndex: 2, folder: "Court Orders", name: "Scheduling order.txt", body: "Sample court order — pitch prototype placeholder content." },
    ];
    for (const s of samples) {
      const matterId = sampleMatters[s.matterIndex]?.id;
      const folderId = folderByName.get(s.folder);
      if (!matterId || !folderId) continue;

      const plaintext = Buffer.from(s.body, "utf8");
      const encrypted = seedEncryptFile(plaintext);
      const document = await db.document.create({
        data: { matterId, folderId, name: s.name, tags: [], confidentiality: "NORMAL", uploadedById: adminId },
      });
      const storageKey = `${document.id}/v1`;
      await seedPutObject(storageKey, encrypted.ciphertext);
      const version = await db.documentVersion.create({
        data: {
          documentId: document.id,
          version: 1,
          storageKey,
          sha256: crypto.createHash("sha256").update(plaintext).digest("hex"),
          mimeType: "text/plain",
          size: plaintext.length,
          encryptedDataKey: encrypted.encryptedDataKey,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          scanStatus: "CLEAN",
          uploadedById: adminId,
        },
      });
      await db.document.update({ where: { id: document.id }, data: { currentVersionId: version.id } });
    }
  }
}

async function main() {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const organization = await db.organization.upsert({ where: { name: ORGANIZATION_NAME }, update: {}, create: { name: ORGANIZATION_NAME, ...ORGANIZATION_DEFAULTS } });

  const superadminUser = await db.user.upsert({ where: { email: superadmin.email }, update: {}, create: superadmin });
  await db.user.update({ where: { id: superadminUser.id }, data: { mustChangePassword: false, passwordChangedAt: new Date() } });
  await db.account.upsert({
    where: { id: (await db.account.findFirst({ where: { userId: superadminUser.id, providerId: "credential" }, select: { id: true } }))?.id ?? "missing" },
    update: { password: passwordHash },
    create: { userId: superadminUser.id, providerId: "credential", accountId: superadminUser.id, password: passwordHash },
  });

  const adminUser = await db.user.upsert({ where: { email: admin.email }, update: { organizationId: organization.id }, create: { ...admin, organizationId: organization.id } });
  await db.user.update({ where: { id: adminUser.id }, data: { mustChangePassword: false, passwordChangedAt: new Date() } });
  await db.account.upsert({
    where: { id: (await db.account.findFirst({ where: { userId: adminUser.id, providerId: "credential" }, select: { id: true } }))?.id ?? "missing" },
    update: { password: passwordHash },
    create: { userId: adminUser.id, providerId: "credential", accountId: adminUser.id, password: passwordHash },
  });

  const lawyerUsers: { id: string; email: string; name: string; isNew: boolean }[] = [];
  for (const [i, l] of lawyers.entries()) {
    const existing = await db.user.findUnique({ where: { email: l.email } });
    const user = await db.user.upsert({
      where: { email: l.email },
      update: { organizationId: organization.id },
      create: {
        name: l.name,
        email: l.email,
        title: l.title,
        role: Role.LAWYER,
        organizationId: organization.id,
        department: "Legal",
        phone: `+256 772 000 10${i}`,
        practisingCertNo: `PC/${String(1040 + i).padStart(5, "0")}`,
        certExpiry: monthsFromNow(l.certMonths),
      },
    });
    await db.account.upsert({
      where: { id: (await db.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { id: true } }))?.id ?? "missing" },
      update: { password: passwordHash },
      create: { userId: user.id, providerId: "credential", accountId: user.id, password: passwordHash },
    });
    lawyerUsers.push({ id: user.id, email: user.email, name: user.name, isNew: !existing });
  }

  await seedReferenceData();

  const lawyersByEmail = new Map(lawyerUsers.map((u) => [u.email, u.id]));
  await seedCases(lawyersByEmail, adminUser.id, organization.id);
  await seedContracts(lawyersByEmail, adminUser.id, organization.id);
  await seedPitchExtras(adminUser.id, lawyerUsers[0]?.id ?? adminUser.id);

  await db.auditLog.create({
    data: { userId: null, action: "seed.run", entity: "System", after: { phase: 4, users: lawyers.length + 1, cases: CASE_SEEDS.length, contracts: CONTRACT_SEEDS.length } },
  });

  console.log(`\nSeeded Superadmin: ${superadminUser.email}`);
  console.log(`  Development password: ${SEED_PASSWORD}`);
  console.log(`\nSeeded Admin: ${adminUser.email}`);
  console.log(`  Development password: ${SEED_PASSWORD}`);
  console.log("  This password is assigned to the Superadmin, the Admin and all seeded lawyers.");
  if (demoPassword) {
    console.log(`\nPrototype lawyer login — password for every lawyer: ${SEED_PASSWORD}`);
    for (const u of lawyerUsers) {
      console.log(`  ${u.email}`);
      try {
        await Promise.race([
          mail.sendMail({
            from: process.env.MAIL_FROM ?? "CAA Legal <no-reply@caa.go.ug>",
            to: u.email,
            subject: "Your CAA Legal account is ready",
            html: `<p>Hello ${u.name},</p><p>Sign in at ${APP_URL}/login</p><p>Email: ${u.email}<br>Password: ${demoPassword}</p>`,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP timeout")), 8000)),
        ]);
      } catch (err) {
        console.log(`    (email not sent — ${(err as Error).message})`);
      }
    }
  }
  console.log(`\nSeeded ${CASE_SEEDS.length} cases and ${CONTRACT_SEEDS.length} contracts (skipping any that already exist from a previous run).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
