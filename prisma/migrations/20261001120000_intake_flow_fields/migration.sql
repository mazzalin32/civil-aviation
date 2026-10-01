-- CreateEnum
CREATE TYPE "ServiceDirection" AS ENUM ('CAA_SERVING', 'CAA_SERVED', 'NOT_YET_SERVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UcaaRole" ADD VALUE 'CLAIMANT';
ALTER TYPE "UcaaRole" ADD VALUE 'PETITIONER';
ALTER TYPE "UcaaRole" ADD VALUE 'INTERESTED_PARTY';
ALTER TYPE "UcaaRole" ADD VALUE 'APPELLANT';
ALTER TYPE "UcaaRole" ADD VALUE 'RESPONDENT_TO_APPEAL';
ALTER TYPE "UcaaRole" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "Matter" ADD COLUMN     "courtStation" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "externalCounselContact" TEXT,
ADD COLUMN     "externalCounselName" TEXT,
ADD COLUMN     "filedAt" DATE,
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "legalRecipientId" TEXT,
ADD COLUMN     "processIssuedAt" DATE,
ADD COLUMN     "processNature" TEXT,
ADD COLUMN     "processReceivedAt" DATE,
ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "reportMethod" TEXT,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reportedBy" TEXT,
ADD COLUMN     "representationStatus" TEXT,
ADD COLUMN     "serviceDirection" "ServiceDirection";

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "organisation" TEXT,
ADD COLUMN     "partyType" TEXT,
ADD COLUMN     "roleInMatter" TEXT;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_legalRecipientId_fkey" FOREIGN KEY ("legalRecipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

