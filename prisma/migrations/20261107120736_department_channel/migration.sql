-- Department channel (spec §5.14): organisation-scoped, with edit / reply / soft delete and a per-user read marker.
-- Also drops the unused placeholder columns that stored raw file URLs.
-- DropIndex
DROP INDEX "GroupMessage_createdAt_idx";

-- AlterTable
ALTER TABLE "GroupMessage" DROP COLUMN "attachmentName",
DROP COLUMN "attachmentUrl",
DROP COLUMN "voiceNoteUrl",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "replyToId" TEXT;

-- Existing rows (the seeded welcome message) belong to their author's organisation.
UPDATE "GroupMessage" g SET "organizationId" = u."organizationId" FROM "User" u WHERE u.id = g."authorId";
DELETE FROM "GroupMessage" WHERE "organizationId" IS NULL; -- an author with no organisation (Superadmin) cannot post to an org channel
ALTER TABLE "GroupMessage" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "GroupChatRead" (
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupChatRead_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateIndex
CREATE INDEX "GroupChatRead_organizationId_idx" ON "GroupChatRead"("organizationId");

-- CreateIndex
CREATE INDEX "GroupMessage_organizationId_createdAt_idx" ON "GroupMessage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "GroupMessage_replyToId_idx" ON "GroupMessage"("replyToId");

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "GroupMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatRead" ADD CONSTRAINT "GroupChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatRead" ADD CONSTRAINT "GroupChatRead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
