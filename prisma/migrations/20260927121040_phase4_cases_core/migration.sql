-- CreateEnum
CREATE TYPE "UcaaRole" AS ENUM ('PLAINTIFF', 'DEFENDANT', 'APPLICANT', 'RESPONDENT', 'ADVISOR');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "Confidentiality" AS ENUM ('NORMAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "MatterStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CLOSURE_REQUESTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('LEAD', 'SUPPORT');

-- CreateEnum
CREATE TYPE "PartyKind" AS ENUM ('OPPOSING', 'WITNESS', 'INTERNAL', 'OTHER');

-- CreateTable
CREATE TABLE "Matter" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "matterTypeId" TEXT NOT NULL,
    "ucaaRole" "UcaaRole" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'NORMAL',
    "status" "MatterStatus" NOT NULL DEFAULT 'OPEN',
    "currentStageId" TEXT,
    "forumId" TEXT,
    "courtCaseNo" TEXT,
    "eccmisNo" TEXT,
    "eccmisUrl" TEXT,
    "judge" TEXT,
    "amountClaimed" BIGINT,
    "amountAgainst" BIGINT,
    "causeOfActionDate" DATE,
    "referralNote" TEXT,
    "outcomeId" TEXT,
    "closingNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Matter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterAssignment" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "MatterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterStage" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "stageTemplateId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "note" TEXT,
    "movedById" TEXT NOT NULL,

    CONSTRAINT "MatterStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PartyKind" NOT NULL,
    "counselName" TEXT,
    "counselFirm" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Matter_reference_key" ON "Matter"("reference");

-- CreateIndex
CREATE INDEX "Matter_status_priority_idx" ON "Matter"("status", "priority");

-- CreateIndex
CREATE INDEX "Matter_categoryId_idx" ON "Matter"("categoryId");

-- CreateIndex
CREATE INDEX "Matter_matterTypeId_idx" ON "Matter"("matterTypeId");

-- CreateIndex
CREATE INDEX "Matter_forumId_idx" ON "Matter"("forumId");

-- CreateIndex
CREATE INDEX "Matter_currentStageId_idx" ON "Matter"("currentStageId");

-- CreateIndex
CREATE INDEX "Matter_lastActivityAt_idx" ON "Matter"("lastActivityAt");

-- CreateIndex
CREATE INDEX "MatterAssignment_matterId_removedAt_idx" ON "MatterAssignment"("matterId", "removedAt");

-- CreateIndex
CREATE INDEX "MatterAssignment_userId_removedAt_idx" ON "MatterAssignment"("userId", "removedAt");

-- CreateIndex
CREATE INDEX "MatterStage_matterId_enteredAt_idx" ON "MatterStage"("matterId", "enteredAt");

-- CreateIndex
CREATE INDEX "Party_matterId_idx" ON "Party"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "WizardDraft_userId_key" ON "WizardDraft"("userId");

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_matterTypeId_fkey" FOREIGN KEY ("matterTypeId") REFERENCES "MatterType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "StageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterAssignment" ADD CONSTRAINT "MatterAssignment_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterAssignment" ADD CONSTRAINT "MatterAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterAssignment" ADD CONSTRAINT "MatterAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStage" ADD CONSTRAINT "MatterStage_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStage" ADD CONSTRAINT "MatterStage_stageTemplateId_fkey" FOREIGN KEY ("stageTemplateId") REFERENCES "StageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStage" ADD CONSTRAINT "MatterStage_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardDraft" ADD CONSTRAINT "WizardDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
