-- Delta on top of 20260929220000_prototype_matter_messages and 20260930082022_pitch_group_chat_law_firms_links.
-- (An earlier version of this file re-created MatterMessage/GroupMessage/LawFirm/ResourceLink, which already
-- exist, so it failed on every database. It now only adds the chat pinning/soft-delete columns, attachments and mentions.)

-- AlterTable
ALTER TABLE "MatterMessage" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MatterMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "MatterMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT,
    "sha256" TEXT,
    "encryptedDataKey" TEXT,
    "iv" TEXT,
    "authTag" TEXT,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'CLEAN',
    "scanDetail" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterMessageMention" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterMessageMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatterMessageAttachment_messageId_idx" ON "MatterMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MatterMessageAttachment_documentId_idx" ON "MatterMessageAttachment"("documentId");

-- CreateIndex
CREATE INDEX "MatterMessageMention_userId_idx" ON "MatterMessageMention"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatterMessageMention_messageId_userId_key" ON "MatterMessageMention"("messageId", "userId");

-- CreateIndex
CREATE INDEX "MatterMessage_matterId_isPinned_idx" ON "MatterMessage"("matterId", "isPinned");

-- AddForeignKey
ALTER TABLE "MatterMessage" ADD CONSTRAINT "MatterMessage_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterMessage" ADD CONSTRAINT "MatterMessage_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterMessageAttachment" ADD CONSTRAINT "MatterMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MatterMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterMessageAttachment" ADD CONSTRAINT "MatterMessageAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterMessageMention" ADD CONSTRAINT "MatterMessageMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MatterMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterMessageMention" ADD CONSTRAINT "MatterMessageMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
