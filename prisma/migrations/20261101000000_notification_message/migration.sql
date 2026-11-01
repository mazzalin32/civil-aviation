-- AlterTable (nullable for now — backfilled below, then enforced)
ALTER TABLE "Notification" ADD COLUMN     "message" TEXT;
ALTER TABLE "Notification" ADD COLUMN     "url" TEXT;

-- Backfill existing rows (pre-dates the in-app notification bell) with a generic line.
UPDATE "Notification" SET "message" = 'You have a notification.' WHERE "message" IS NULL;

ALTER TABLE "Notification" ALTER COLUMN "message" SET NOT NULL;
