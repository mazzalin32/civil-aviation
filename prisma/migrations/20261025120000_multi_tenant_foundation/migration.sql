-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable for now — backfilled below, then enforced on Matter/Contract)
ALTER TABLE "User" ADD COLUMN     "organizationId" TEXT;
ALTER TABLE "Matter" ADD COLUMN     "organizationId" TEXT;
ALTER TABLE "Contract" ADD COLUMN     "organizationId" TEXT;

-- Data migration: every existing User/Matter/Contract belongs to one real organisation today
-- (2026-10-25 — multi-tenancy foundation). Create it and backfill before enforcing NOT NULL.
INSERT INTO "Organization" ("id", "name", "logoUrl", "primaryColor", "updatedAt")
VALUES (gen_random_uuid()::text, 'Uganda Civil Aviation Authority', '/CAA-Uganda-logo-1.png', '#4169E1', now());

UPDATE "User" SET "organizationId" = (SELECT "id" FROM "Organization" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "Matter" SET "organizationId" = (SELECT "id" FROM "Organization" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "Contract" SET "organizationId" = (SELECT "id" FROM "Organization" LIMIT 1) WHERE "organizationId" IS NULL;

-- Matter/Contract always belong to an organisation; User stays nullable (null = SUPERADMIN).
ALTER TABLE "Matter" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Contract" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Contract_organizationId_idx" ON "Contract"("organizationId");

-- CreateIndex
CREATE INDEX "Matter_organizationId_idx" ON "Matter"("organizationId");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");
