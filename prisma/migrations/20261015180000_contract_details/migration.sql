-- CreateEnum
CREATE TYPE "ContractExecutionStatus" AS ENUM ('PENDING', 'SIGNED');

-- CreateEnum
CREATE TYPE "ContractStatusCategory" AS ENUM ('RECEIPT', 'LEGAL_REVIEW', 'INTERNAL_APPROVAL', 'AG_VETTING', 'AMENDMENTS');

-- AlterTable
ALTER TABLE "Matter" DROP COLUMN "contractSigned";

-- CreateTable
CREATE TABLE "ContractDetail" (
    "matterId" TEXT NOT NULL,
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

    CONSTRAINT "ContractDetail_pkey" PRIMARY KEY ("matterId")
);

-- CreateTable
CREATE TABLE "ContractStatusOption" (
    "id" TEXT NOT NULL,
    "category" "ContractStatusCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContractStatusOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractDetail_receiptStatusId_idx" ON "ContractDetail"("receiptStatusId");

-- CreateIndex
CREATE INDEX "ContractDetail_legalReviewStatusId_idx" ON "ContractDetail"("legalReviewStatusId");

-- CreateIndex
CREATE INDEX "ContractDetail_internalApprovalStatusId_idx" ON "ContractDetail"("internalApprovalStatusId");

-- CreateIndex
CREATE INDEX "ContractDetail_agVettingStatusId_idx" ON "ContractDetail"("agVettingStatusId");

-- CreateIndex
CREATE INDEX "ContractDetail_amendmentsStatusId_idx" ON "ContractDetail"("amendmentsStatusId");

-- CreateIndex
CREATE INDEX "ContractStatusOption_category_order_idx" ON "ContractStatusOption"("category", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ContractStatusOption_category_label_key" ON "ContractStatusOption"("category", "label");

-- AddForeignKey
ALTER TABLE "ContractDetail" ADD CONSTRAINT "ContractDetail_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDetail" ADD CONSTRAINT "ContractDetail_receiptStatusId_fkey" FOREIGN KEY ("receiptStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDetail" ADD CONSTRAINT "ContractDetail_legalReviewStatusId_fkey" FOREIGN KEY ("legalReviewStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDetail" ADD CONSTRAINT "ContractDetail_internalApprovalStatusId_fkey" FOREIGN KEY ("internalApprovalStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDetail" ADD CONSTRAINT "ContractDetail_agVettingStatusId_fkey" FOREIGN KEY ("agVettingStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDetail" ADD CONSTRAINT "ContractDetail_amendmentsStatusId_fkey" FOREIGN KEY ("amendmentsStatusId") REFERENCES "ContractStatusOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

