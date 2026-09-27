/**
 * Seed — idempotent, safe to re-run. Grows each phase (PROJECT_SPEC.md §12).
 * Deliberately self-contained: no import of src/lib/* here, since those files are
 * marked "server-only" and throw when loaded outside a Next.js server context.
 *
 * Phase 1: the Admin gets a real temporary password (must change at first login);
 * each lawyer gets a live activation link, emailed via Mailpit — check
 * http://localhost:8026 after running this, or read the link printed below.
 * Phase 2: Admin Settings reference data (categories, matter types & lifecycle
 * stages, forums, event/document types, outcomes, reminder rules) — spec §5.13.
 * Phase 4: 15 realistic cases across every matter type and lawyer, the mockup case
 * (docs/design/case-page.html) among them, matched by reference so re-running the
 * seed never creates duplicates.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import nodemailer from "nodemailer";
import { PrismaClient, Role, AssignmentRole, PartyKind } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const mail = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1026),
});
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const ACTIVATION_HOURS = 72;

const monthsFromNow = (months: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

const admin = {
  email: process.env.SEED_ADMIN_EMAIL ?? "head.legal@caa.go.ug",
  name: process.env.SEED_ADMIN_NAME ?? "Head of Legal",
  role: Role.ADMIN,
  title: "Director Legal Services",
  department: "Legal",
  mustChangePassword: true,
};

// Sample lawyers for development and demos — replace with real accounts via Users (Phase 3) or Import (Phase 12).
const lawyers = [
  { name: "Agnes Nakato", email: "agnes.nakato@caa.go.ug", title: "Senior Legal Officer", certMonths: 14 },
  { name: "Brian Okello", email: "brian.okello@caa.go.ug", title: "Legal Officer", certMonths: 1 }, // expiring soon → exercises cert alerts
  { name: "Carol Atim", email: "carol.atim@caa.go.ug", title: "Legal Officer", certMonths: 9 },
  { name: "David Ssemwogerere", email: "david.ssemwogerere@caa.go.ug", title: "Principal Legal Officer", certMonths: 20 },
];

/** Hand-inserts the same row shape `auth.api.requestPasswordReset` would create. */
async function sendActivationLink(userId: string, email: string, name: string, isFirstInvite: boolean) {
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ACTIVATION_HOURS * 60 * 60 * 1000);
  await db.verification.create({ data: { identifier: `reset-password:${token}`, value: userId, expiresAt } });

  const url = `${APP_URL}/activate?token=${token}`;
  const subject = isFirstInvite ? "Set up your CAA Legal account" : "Set your CAA Legal password";
  await mail.sendMail({
    from: "CAA Legal <no-reply@caa.go.ug>",
    to: email,
    subject,
    html: `<p>Hello ${name},</p><p><a href="${url}">${subject}</a></p><p>Valid ${ACTIVATION_HOURS} hours, single use.</p>`,
  });
  console.log(`  ${email} → ${url}`);
}

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
      { name: "Intake" },
      { name: "Pre-action", description: "Demand letter / statutory notice" },
      { name: "Filed & served" },
      { name: "Pleadings", description: "Ends when pleadings close" },
      { name: "Mediation", allowsClosure: true },
      { name: "Scheduling conference" },
      { name: "Hearing" },
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
      { name: "Application filed" },
      { name: "Response" },
      { name: "Hearing" },
      { name: "Decision", allowsClosure: true },
      { name: "Appeal", allowsClosure: true },
      { name: "Closed", allowsClosure: true },
    ],
  },
  {
    name: "Arbitration / ADR",
    referencePrefix: "ARB",
    stages: [
      { name: "Notice of dispute" },
      { name: "Tribunal constituted" },
      { name: "Statements of case" },
      { name: "Hearing" },
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
      { name: "Investigation" },
      { name: "Notice to operator" },
      { name: "Response" },
      { name: "Decision", allowsClosure: true },
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
      { name: "Draft" },
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
    stages: [{ name: "Notice of appeal" }, { name: "Record of appeal" }, { name: "Hearing" }, { name: "Judgment", allowsClosure: true }],
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
  { trigger: "MESSAGE_MENTION", label: "New message or @mention", offsets: [0], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "DOCUMENT_UPLOADED", label: "Document uploaded to your case", offsets: [0], channels: ["IN_APP"], mutable: true },
  { trigger: "STAGE_OR_CLOSURE_CHANGED", label: "Stage changed / closure requested or approved", offsets: [0], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "CASE_INACTIVE", label: "Case inactive 30+ days", offsets: [30], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "CERT_EXPIRING", label: "Practising certificate expiring", offsets: [30], channels: ["IN_APP", "EMAIL"], mutable: true },
  { trigger: "SUSPICIOUS_ACTIVITY", label: "Suspicious activity (mass download, failed logins)", offsets: [0], channels: ["EMAIL"], mutable: false },
];

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
        update: {},
        create: {
          matterTypeId: created.id,
          name: s.name,
          description: s.description ?? null,
          allowsClosure: s.allowsClosure ?? false,
          order: j,
        },
      });
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
}

// --- Phase 4: 15 realistic cases (spec §12), the mockup case (docs/design/case-page.html) among them ---

type CaseSeed = {
  title: string;
  categoryName: string;
  matterTypeName: string;
  stageName: string;
  ucaaRole: "PLAINTIFF" | "DEFENDANT" | "APPLICANT" | "RESPONDENT" | "ADVISOR";
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
};

const CASE_SEEDS: CaseSeed[] = [
  {
    title: "Uganda Civil Aviation Authority v. Nile Horizon Aviation Ltd",
    categoryName: "Debt Recovery",
    matterTypeName: "Civil litigation",
    stageName: "Mediation",
    ucaaRole: "PLAINTIFF",
    priority: "HIGH",
    forumName: "High Court — Commercial Division",
    courtCaseNo: "CS 412 of 2026",
    eccmisNo: "HCT-00-CC-CS-0412-2026",
    amountClaimed: BigInt(1_840_000_000),
    causeOfActionDate: "2024-03-01",
    referralNote: "Referral memo from Finance: UGX 1.84bn outstanding in landing, parking and navigation charges.",
    openedAt: "2026-01-12",
    lastActivityAt: "2026-09-18",
    leadEmail: "agnes.nakato@caa.go.ug",
    supportEmails: ["brian.okello@caa.go.ug", "carol.atim@caa.go.ug"],
    opposing: [{ name: "Nile Horizon Aviation Ltd", counselName: "M/s Kato & Partners Advocates", counselFirm: "Kato & Partners Advocates" }],
  },
  {
    title: "Advisory: Ground handling concession — competitive process",
    categoryName: "Procurement",
    matterTypeName: "Advisory",
    stageName: "Draft",
    ucaaRole: "ADVISOR",
    priority: "MEDIUM",
    referralNote: "Procurement department requests an opinion on structuring the next ground-handling concession tender.",
    openedAt: "2026-07-02",
    lastActivityAt: "2026-09-10",
    leadEmail: "david.ssemwogerere@caa.go.ug",
  },
  {
    title: "Namutebi v. Uganda Civil Aviation Authority",
    categoryName: "Employment",
    matterTypeName: "Civil litigation",
    stageName: "Pleadings",
    ucaaRole: "DEFENDANT",
    priority: "MEDIUM",
    forumName: "Industrial Court",
    courtCaseNo: "LD 88 of 2026",
    amountAgainst: BigInt(240_000_000),
    causeOfActionDate: "2025-11-20",
    referralNote: "Former ramp supervisor alleges unlawful termination.",
    openedAt: "2026-02-15",
    lastActivityAt: "2026-09-05",
    leadEmail: "carol.atim@caa.go.ug",
    opposing: [{ name: "Namutebi Sarah", counselName: "Nabwire & Co. Advocates" }],
  },
  {
    title: "Enforcement: Unlicensed ground transport operators, Entebbe apron",
    categoryName: "Regulatory & Licensing",
    matterTypeName: "Regulatory enforcement",
    stageName: "Investigation",
    ucaaRole: "APPLICANT",
    priority: "HIGH",
    referralNote: "Airport security flagged repeated unlicensed vehicle access.",
    openedAt: "2026-06-01",
    lastActivityAt: "2026-09-20",
    leadEmail: "brian.okello@caa.go.ug",
  },
  {
    title: "Uganda Civil Aviation Authority v. Kaggwa Estates Ltd",
    categoryName: "Land & Property",
    matterTypeName: "Tribunal proceedings",
    stageName: "Hearing",
    ucaaRole: "APPLICANT",
    priority: "MEDIUM",
    forumName: "PPDA Appeals Tribunal",
    courtCaseNo: "PPDA/APP/014/2026",
    amountClaimed: BigInt(610_000_000),
    causeOfActionDate: "2025-08-10",
    openedAt: "2025-10-05",
    lastActivityAt: "2026-08-28",
    leadEmail: "david.ssemwogerere@caa.go.ug",
    opposing: [{ name: "Kaggwa Estates Ltd" }],
  },
  {
    title: "UCAA v. SkyBridge Cargo Handlers (arbitration)",
    categoryName: "Compensation & Torts",
    matterTypeName: "Arbitration / ADR",
    stageName: "Statements of case",
    ucaaRole: "RESPONDENT",
    priority: "HIGH",
    forumName: "CADER (Arbitration)",
    amountAgainst: BigInt(950_000_000),
    causeOfActionDate: "2025-12-02",
    referralNote: "Cargo damage claim following a warehouse incident.",
    openedAt: "2026-03-20",
    lastActivityAt: "2026-09-22",
    leadEmail: "agnes.nakato@caa.go.ug",
    supportEmails: ["david.ssemwogerere@caa.go.ug"],
    opposing: [{ name: "SkyBridge Cargo Handlers Ltd", counselName: "Mugisha & Partners" }],
  },
  {
    title: "Recovery: Overdue concession fees — Highland Duty Free",
    categoryName: "Debt Recovery",
    matterTypeName: "Debt recovery (pre-suit)",
    stageName: "Negotiation / payment plan",
    ucaaRole: "PLAINTIFF",
    priority: "LOW",
    amountClaimed: BigInt(84_000_000),
    causeOfActionDate: "2026-01-15",
    openedAt: "2026-04-10",
    lastActivityAt: "2026-08-30",
    leadEmail: "carol.atim@caa.go.ug",
    opposing: [{ name: "Highland Duty Free Ltd" }],
  },
  {
    title: "UCAA v. Attorney General & Minister of Works (judicial review)",
    categoryName: "Judicial Review",
    matterTypeName: "Civil litigation",
    stageName: "Filed & served",
    ucaaRole: "APPLICANT",
    priority: "URGENT",
    forumName: "High Court — Civil Division",
    courtCaseNo: "MC 21 of 2026",
    causeOfActionDate: "2026-08-01",
    referralNote: "Challenging a directive affecting airspace management authority.",
    openedAt: "2026-08-20",
    lastActivityAt: "2026-09-24",
    leadEmail: "david.ssemwogerere@caa.go.ug",
    supportEmails: ["agnes.nakato@caa.go.ug"],
  },
  {
    title: "Republic v. Byaruhanga (cargo theft, tribunal referral)",
    categoryName: "Criminal / Prosecution",
    matterTypeName: "Tribunal proceedings",
    stageName: "Response",
    ucaaRole: "APPLICANT",
    priority: "HIGH",
    forumName: "Chief Magistrate's Court",
    courtCaseNo: "CR 310 of 2026",
    openedAt: "2026-05-18",
    lastActivityAt: "2026-09-12",
    leadEmail: "brian.okello@caa.go.ug",
    opposing: [{ name: "Byaruhanga Moses" }],
  },
  {
    title: "Advisory: Drone operator licensing framework — regional carriers",
    categoryName: "Regulatory & Licensing",
    matterTypeName: "Advisory",
    stageName: "Issued",
    status: "CLOSED",
    ucaaRole: "ADVISOR",
    priority: "LOW",
    openedAt: "2025-09-01",
    lastActivityAt: "2025-11-15",
    closedAt: "2025-11-15",
    leadEmail: "agnes.nakato@caa.go.ug",
  },
  {
    title: "UCAA v. Meridian Fuel Supplies Ltd (settled)",
    categoryName: "Contracts & Commercial",
    matterTypeName: "Civil litigation",
    stageName: "Closed",
    status: "CLOSED",
    ucaaRole: "PLAINTIFF",
    priority: "MEDIUM",
    forumName: "High Court — Commercial Division",
    courtCaseNo: "CS 77 of 2025",
    amountClaimed: BigInt(320_000_000),
    openedAt: "2025-03-10",
    lastActivityAt: "2025-12-01",
    closedAt: "2025-12-01",
    leadEmail: "carol.atim@caa.go.ug",
    opposing: [{ name: "Meridian Fuel Supplies Ltd", counselFirm: "Byamugisha & Co. Advocates" }],
  },
  {
    title: "Kintu v. Uganda Civil Aviation Authority (on hold pending mediation)",
    categoryName: "Employment",
    matterTypeName: "Civil litigation",
    stageName: "Scheduling conference",
    status: "ON_HOLD",
    ucaaRole: "DEFENDANT",
    priority: "MEDIUM",
    forumName: "Industrial Court",
    courtCaseNo: "LD 45 of 2026",
    causeOfActionDate: "2026-01-05",
    openedAt: "2026-02-28",
    lastActivityAt: "2026-07-14",
    leadEmail: "david.ssemwogerere@caa.go.ug",
    opposing: [{ name: "Kintu Robert" }],
  },
  {
    title: "UCAA v. Greenview Properties (way-leave dispute)",
    categoryName: "Land & Property",
    matterTypeName: "Tribunal proceedings",
    stageName: "Decision",
    ucaaRole: "APPLICANT",
    priority: "HIGH",
    forumName: "Tax Appeals Tribunal",
    amountClaimed: BigInt(145_000_000),
    openedAt: "2025-06-12",
    lastActivityAt: "2026-09-01",
    leadEmail: "agnes.nakato@caa.go.ug",
    opposing: [{ name: "Greenview Properties Ltd" }],
  },
  {
    title: "Recovery: Written-off parking charges — Coastal Air Charters",
    categoryName: "Debt Recovery",
    matterTypeName: "Debt recovery (pre-suit)",
    stageName: "Recovered / written off",
    status: "CLOSED",
    ucaaRole: "PLAINTIFF",
    priority: "LOW",
    amountClaimed: BigInt(12_500_000),
    openedAt: "2025-08-01",
    lastActivityAt: "2025-10-20",
    closedAt: "2025-10-20",
    leadEmail: "brian.okello@caa.go.ug",
    opposing: [{ name: "Coastal Air Charters Ltd" }],
  },
  {
    title: "UCAA v. Prime Construction Uganda Ltd (terminal works dispute)",
    categoryName: "Procurement",
    matterTypeName: "Civil litigation",
    stageName: "Submissions",
    ucaaRole: "DEFENDANT",
    priority: "URGENT",
    forumName: "High Court — Commercial Division",
    courtCaseNo: "CS 205 of 2025",
    amountAgainst: BigInt(2_100_000_000),
    causeOfActionDate: "2025-05-14",
    referralNote: "Contractor claims a variation was wrongly rejected on the terminal expansion works.",
    openedAt: "2025-07-22",
    lastActivityAt: "2026-09-25",
    leadEmail: "carol.atim@caa.go.ug",
    supportEmails: ["david.ssemwogerere@caa.go.ug"],
    opposing: [{ name: "Prime Construction Uganda Ltd", counselName: "Ariko & Ariko Advocates" }],
  },
];

async function seedCases(lawyersByEmail: Map<string, string>, adminId: string) {
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
    if (existing) continue; // idempotent re-run — seeded cases are never edited by the seed itself

    const matter = await db.matter.create({
      data: {
        reference,
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

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
  const adminUser = await db.user.upsert({ where: { email: admin.email }, update: {}, create: admin });
  const hadAdminAccount = await db.account.findFirst({ where: { userId: adminUser.id, providerId: "credential" } });
  if (!hadAdminAccount) {
    await db.account.create({
      data: { userId: adminUser.id, providerId: "credential", accountId: adminUser.id, password: await hashPassword(adminPassword) },
    });
  }

  const lawyerUsers: { id: string; email: string; name: string; isNew: boolean }[] = [];
  for (const [i, l] of lawyers.entries()) {
    const existing = await db.user.findUnique({ where: { email: l.email } });
    const user = await db.user.upsert({
      where: { email: l.email },
      update: {},
      create: {
        name: l.name,
        email: l.email,
        title: l.title,
        role: Role.LAWYER,
        department: "Legal",
        phone: `+256 772 000 10${i}`,
        practisingCertNo: `PC/${String(1040 + i).padStart(5, "0")}`,
        certExpiry: monthsFromNow(l.certMonths),
      },
    });
    lawyerUsers.push({ id: user.id, email: user.email, name: user.name, isNew: !existing });
  }

  await seedReferenceData();

  const lawyersByEmail = new Map(lawyerUsers.map((u) => [u.email, u.id]));
  await seedCases(lawyersByEmail, adminUser.id);

  await db.auditLog.create({
    data: { userId: null, action: "seed.run", entity: "System", after: { phase: 4, users: lawyers.length + 1, cases: CASE_SEEDS.length } },
  });

  console.log(`\nSeeded Admin: ${adminUser.email}`);
  if (!hadAdminAccount) console.log(`  Temporary password: ${adminPassword}  (must change at first login)`);
  console.log(`\nActivation links (also sent to Mailpit — http://localhost:8026):`);
  for (const u of lawyerUsers) {
    const hasAccount = await db.account.findFirst({ where: { userId: u.id, providerId: "credential" } });
    if (!hasAccount) await sendActivationLink(u.id, u.email, u.name, u.isNew);
    else console.log(`  ${u.email} → already activated`);
  }
  console.log(`\nSeeded ${CASE_SEEDS.length} cases (skipping any that already exist from a previous run).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
