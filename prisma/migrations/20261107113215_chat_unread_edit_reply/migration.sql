-- AlterTable
ALTER TABLE "MatterMessage" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "replyToId" TEXT;

-- CreateTable
CREATE TABLE "MatterChatRead" (
    "userId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterChatRead_pkey" PRIMARY KEY ("userId","matterId")
);

-- CreateIndex
CREATE INDEX "MatterChatRead_matterId_idx" ON "MatterChatRead"("matterId");

-- CreateIndex
CREATE INDEX "MatterMessage_replyToId_idx" ON "MatterMessage"("replyToId");

-- AddForeignKey
ALTER TABLE "MatterMessage" ADD CONSTRAINT "MatterMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "MatterMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterChatRead" ADD CONSTRAINT "MatterChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterChatRead" ADD CONSTRAINT "MatterChatRead_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
