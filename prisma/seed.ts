/**
 * Seed — idempotent, safe to re-run. Grows each phase (PROJECT_SPEC.md §12).
 * Deliberately self-contained: no import of src/lib/* here, since those files are
 * marked "server-only" and throw when loaded outside a Next.js server context.
 *
 * Phase 1: the Admin gets a real temporary password (must change at first login);
 * each lawyer gets a live activation link, emailed via Mailpit — check
 * http://localhost:8025 after running this, or read the link printed below.
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

  await db.auditLog.create({
    data: { userId: null, action: "seed.run", entity: "System", after: { phase: 1, users: lawyers.length + 1 } },
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
