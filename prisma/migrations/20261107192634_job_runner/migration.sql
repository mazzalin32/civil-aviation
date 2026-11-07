-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "emailDueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationRule" ADD COLUMN     "offsetUnit" TEXT NOT NULL DEFAULT 'DAYS';

-- CreateTable
CREATE TABLE "ReminderLog" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ReminderLog_createdAt_idx" ON "ReminderLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_emailDueAt_idx" ON "Notification"("emailDueAt");

-- Data (hand-written): bring existing databases in line with the seed defaults for the job runner.
-- The seed only inserts rules that are missing, so without this an existing install keeps the old rows.

-- The chat email fallback: chat notifications email only if still unread after this many minutes (FLOWS §10).
INSERT INTO "NotificationRule" ("id", "trigger", "label", "offsets", "offsetUnit", "channels", "mutable")
VALUES ('rule_chat_unread_email', 'CHAT_UNREAD_EMAIL', 'Chat email: sent only if still unread after', ARRAY[10], 'MINUTES', ARRAY['EMAIL'], false)
ON CONFLICT ("trigger") DO NOTHING;

-- Deadlines get an overdue reminder the day after (spec §5.9 "+ overdue"), unless an Admin already set one.
UPDATE "NotificationRule" SET "offsets" = array_append("offsets", -1)
WHERE "trigger" = 'DEADLINE_REMINDER' AND NOT EXISTS (SELECT 1 FROM unnest("offsets") o WHERE o < 0);

-- Team messages and replies may now email too — always deferred and only if still unread (FLOWS §10).
UPDATE "NotificationRule" SET "channels" = array_append("channels", 'EMAIL')
WHERE "trigger" IN ('CASE_MESSAGE', 'MESSAGE_REPLY') AND NOT ('EMAIL' = ANY("channels"));
