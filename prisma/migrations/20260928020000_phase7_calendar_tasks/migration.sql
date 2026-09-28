-- CreateEnum
CREATE TYPE "CalendarKind" AS ENUM ('HEARING', 'MENTION', 'MEDIATION', 'JUDGMENT', 'DEADLINE', 'PERSONAL');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('OPEN', 'DONE', 'NA');

-- CreateEnum
CREATE TYPE "CalendarOutcomeType" AS ENUM ('PROCEEDED', 'ADJOURNED', 'RULING', 'DIRECTIONS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "icsToken" TEXT;

-- CreateTable
CREATE TABLE "CalendarEntry" (
    "id" TEXT NOT NULL,
    "matterId" TEXT,
    "userId" TEXT,
    "kind" "CalendarKind" NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "forumId" TEXT,
    "courtroom" TEXT,
    "purpose" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" TEXT,
    "status" "EntryStatus" NOT NULL DEFAULT 'OPEN',
    "naReason" TEXT,
    "outcomeType" "CalendarOutcomeType",
    "outcomeNote" TEXT,
    "adjournmentReason" TEXT,
    "outcomeRecordedAt" TIMESTAMP(3),
    "outcomeRecordedById" TEXT,
    "nextEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "status" "EntryStatus" NOT NULL DEFAULT 'OPEN',
    "naReason" TEXT,
    "sourceEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadlineRule" (
    "id" TEXT NOT NULL,
    "triggerEventTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeadlineRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEntry_nextEntryId_key" ON "CalendarEntry"("nextEntryId");

-- CreateIndex
CREATE INDEX "CalendarEntry_matterId_idx" ON "CalendarEntry"("matterId");

-- CreateIndex
CREATE INDEX "CalendarEntry_assigneeId_startsAt_idx" ON "CalendarEntry"("assigneeId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEntry_userId_startsAt_idx" ON "CalendarEntry"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "Task_matterId_idx" ON "Task"("matterId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_dueAt_idx" ON "Task"("assigneeId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_icsToken_key" ON "User"("icsToken");

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_outcomeRecordedById_fkey" FOREIGN KEY ("outcomeRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_nextEntryId_fkey" FOREIGN KEY ("nextEntryId") REFERENCES "CalendarEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "CalendarEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineRule" ADD CONSTRAINT "DeadlineRule_triggerEventTypeId_fkey" FOREIGN KEY ("triggerEventTypeId") REFERENCES "EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

