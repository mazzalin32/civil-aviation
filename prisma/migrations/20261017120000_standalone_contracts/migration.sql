-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "contractId" TEXT;

-- CreateTable
CREATE TABLE "ContractStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "allowsClosure" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContractStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "counterpartyName" TEXT NOT NULL,
    "counterpartyContact" TEXT,
    "originatingDepartment" TEXT,
    "dateOfReceipt" DATE,
    "dateSubmittedForReview" DATE,
    "receiptStatusId" TEXT,
    "legalReviewStatusId" TEXT,
    "internalApprovalStatusId" TEXT,
    "agVettingStatusId" TEXT,
    "amendmentsStatusId" TEXT,
    "caaExecutionStatus" "ContractExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "counterpartyExecutionStatus" "ContractExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "dateOfSignature" DATE,
    "dateOfFullExecution" DATE,
    "commencementDate" DATE,
    "expiryDate" DATE,
    "outstandingAction" TEXT,
    "currentStageId" TEXT,
    "sourceUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAssignment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "ContractAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocument" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tags" TEXT[],
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'NORMAL',
    "currentVersionId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "encryptedDataKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanDetail" TEXT,
    "extractedText" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocumentAccessLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "DocumentAction" NOT NULL,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractStage_name_key" ON "ContractStage"("name");

-- CreateIndex
CREATE INDEX "ContractStage_order_idx" ON "ContractStage"("order");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_reference_key" ON "Contract"("reference");

-- CreateIndex
CREATE INDEX "Contract_categoryId_idx" ON "Contract"("categoryId");

-- CreateIndex
CREATE INDEX "Contract_currentStageId_idx" ON "Contract"("currentStageId");

-- CreateIndex
CREATE INDEX "Contract_receiptStatusId_idx" ON "Contract"("receiptStatusId");

-- CreateIndex
CREATE INDEX "Contract_legalReviewStatusId_idx" ON "Contract"("legalReviewStatusId");

-- CreateIndex
CREATE INDEX "Contract_internalApprovalStatusId_idx" ON "Contract"("internalApprovalStatusId");

-- CreateIndex
CREATE INDEX "Contract_agVettingStatusId_idx" ON "Contract"("agVettingStatusId");

-- CreateIndex
CREATE INDEX "Contract_amendmentsStatusId_idx" ON "Contract"("amendmentsStatusId");

-- CreateIndex
CREATE INDEX "Contract_lastActivityAt_idx" ON "Contract"("lastActivityAt");

-- CreateIndex
CREATE INDEX "ContractAssignment_contractId_removedAt_idx" ON "ContractAssignment"("contractId", "removedAt");

-- CreateIndex
CREATE INDEX "ContractAssignment_userId_removedAt_idx" ON "ContractAssignment"("userId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDocument_currentVersionId_key" ON "ContractDocument"("currentVersionId");

-- CreateIndex
CREATE INDEX "ContractDocument_contractId_deletedAt_idx" ON "ContractDocument"("contractId", "deletedAt");

-- CreateIndex
CREATE INDEX "ContractDocument_folderId_idx" ON "ContractDocument"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDocumentVersion_documentId_version_key" ON "ContractDocumentVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "ContractDocumentAccessLog_documentId_at_idx" ON "ContractDocumentAccessLog"("documentId", "at");

-- CreateIndex
CREATE INDEX "ContractDocumentAccessLog_userId_at_idx" ON "ContractDocumentAccessLog"("userId", "at");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_receiptStatusId_fkey" FOREIGN KEY ("receiptStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_legalReviewStatusId_fkey" FOREIGN KEY ("legalReviewStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_internalApprovalStatusId_fkey" FOREIGN KEY ("internalApprovalStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_agVettingStatusId_fkey" FOREIGN KEY ("agVettingStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_amendmentsStatusId_fkey" FOREIGN KEY ("amendmentsStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "ContractStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAssignment" ADD CONSTRAINT "ContractAssignment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAssignment" ADD CONSTRAINT "ContractAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAssignment" ADD CONSTRAINT "ContractAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ContractDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocumentVersion" ADD CONSTRAINT "ContractDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ContractDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocumentVersion" ADD CONSTRAINT "ContractDocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocumentAccessLog" ADD CONSTRAINT "ContractDocumentAccessLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ContractDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocumentAccessLog" ADD CONSTRAINT "ContractDocumentAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data migration: carry every existing Contract-type Matter (ContractDetail row) over to the
-- new standalone Contract table before dropping ContractDetail, so no in-flight contract data
-- is lost by this restructuring (2026-10-17 — Contracts made fully independent of Matter after
-- a contract was accidentally deleted via the shared matter-delete action).
INSERT INTO "Contract" (
  "id", "reference", "title", "categoryId", "counterpartyName", "originatingDepartment",
  "dateOfReceipt", "dateSubmittedForReview", "receiptStatusId", "legalReviewStatusId",
  "internalApprovalStatusId", "agVettingStatusId", "amendmentsStatusId", "caaExecutionStatus",
  "counterpartyExecutionStatus", "dateOfSignature", "dateOfFullExecution", "commencementDate",
  "expiryDate", "outstandingAction", "sourceUrl", "createdById", "createdAt", "lastActivityAt",
  "deletedAt", "deletedById"
)
SELECT
  m."id", m."reference", m."title", m."categoryId",
  COALESCE((SELECT p."name" FROM "Party" p WHERE p."matterId" = m."id" AND p."kind" IN ('OPPOSING', 'OTHER') ORDER BY p."name" LIMIT 1), 'Unknown counterparty'),
  cd."originatingDepartment", cd."dateOfReceipt", cd."dateSubmittedForReview", cd."receiptStatusId",
  cd."legalReviewStatusId", cd."internalApprovalStatusId", cd."agVettingStatusId", cd."amendmentsStatusId",
  cd."caaExecutionStatus", cd."counterpartyExecutionStatus", cd."dateOfSignature", cd."dateOfFullExecution",
  cd."commencementDate", cd."expiryDate", cd."outstandingAction", m."sourceUrl", m."createdById", m."createdAt",
  m."lastActivityAt", m."deletedAt", m."deletedById"
FROM "ContractDetail" cd
JOIN "Matter" m ON m."id" = cd."matterId";

-- Carry over team assignments (Lead/Support) for those same matters.
INSERT INTO "ContractAssignment" ("id", "contractId", "userId", "role", "assignedAt", "assignedById", "removedAt")
SELECT gen_random_uuid()::text, ma."matterId", ma."userId", ma."role", ma."assignedAt", ma."assignedById", ma."removedAt"
FROM "MatterAssignment" ma
WHERE ma."matterId" IN (SELECT "matterId" FROM "ContractDetail");

-- The old Matter rows are superseded by the new Contract rows above — soft delete them (never
-- hard-delete, CLAUDE.md) so they stop appearing in Legal Matters while keeping their history.
UPDATE "Matter" m
SET "deletedAt" = COALESCE(m."deletedAt", now()), "deletedById" = COALESCE(m."deletedById", m."createdById")
WHERE m."id" IN (SELECT "matterId" FROM "ContractDetail");

-- DropForeignKey
ALTER TABLE "ContractDetail" DROP CONSTRAINT "ContractDetail_agVettingStatusId_fkey";

-- DropForeignKey
ALTER TABLE "ContractDetail" DROP CONSTRAINT "ContractDetail_amendmentsStatusId_fkey";

-- DropForeignKey
ALTER TABLE "ContractDetail" DROP CONSTRAINT "ContractDetail_internalApprovalStatusId_fkey";

-- DropForeignKey
ALTER TABLE "ContractDetail" DROP CONSTRAINT "ContractDetail_legalReviewStatusId_fkey";

-- DropForeignKey
ALTER TABLE "ContractDetail" DROP CONSTRAINT "ContractDetail_matterId_fkey";

-- DropForeignKey
ALTER TABLE "ContractDetail" DROP CONSTRAINT "ContractDetail_receiptStatusId_fkey";

-- DropTable
DROP TABLE "ContractDetail";

