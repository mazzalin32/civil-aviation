/**
 * Seed — idempotent, safe to re-run. Grows each phase (PROJECT_SPEC.md §12).
 * Phase 0: the first Admin + 4 sample lawyers. Passwords/2FA are set up in Phase 1
 * (Admin: temporary password; lawyers: invite links).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/** Dates relative to today so seed data never goes stale. */
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

async function main() {
  const adminUser = await db.user.upsert({ where: { email: admin.email }, update: {}, create: admin });

  for (const [i, l] of lawyers.entries()) {
    await db.user.upsert({
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
  }

  await db.auditLog.create({
    data: { userId: null, action: "seed.run", entity: "System", after: { phase: 0, users: lawyers.length + 1 } },
  });

  console.log(`Seeded Admin (${adminUser.email}) and ${lawyers.length} lawyers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
