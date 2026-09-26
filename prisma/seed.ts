/**
 * Seed — idempotent, safe to re-run. Grows each phase (PROJECT_SPEC.md §12).
 * Deliberately self-contained: no import of src/lib/* here, since those files are
 * marked "server-only" and throw when loaded outside a Next.js server context.
 *
 * Phase 1: the Admin gets a real temporary password (must change at first login);
 * each lawyer gets a live activation link, emailed via Mailpit — check
 * http://localhost:8025 after running this, or read the link printed below.
 * Phase 2: Admin Settings reference data (categories, matter types & lifecycle
 * stages, forums, event/document types, outcomes, reminder rules) — spec §5.13.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import nodemailer from "nodemailer";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const mail = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
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

  await db.auditLog.create({
    data: { userId: null, action: "seed.run", entity: "System", after: { phase: 2, users: lawyers.length + 1 } },
  });

  console.log(`\nSeeded Admin: ${adminUser.email}`);
  if (!hadAdminAccount) console.log(`  Temporary password: ${adminPassword}  (must change at first login)`);
  console.log(`\nActivation links (also sent to Mailpit — http://localhost:8025):`);
  for (const u of lawyerUsers) {
    const hasAccount = await db.account.findFirst({ where: { userId: u.id, providerId: "credential" } });
    if (!hasAccount) await sendActivationLink(u.id, u.email, u.name, u.isNew);
    else console.log(`  ${u.email} → already activated`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
