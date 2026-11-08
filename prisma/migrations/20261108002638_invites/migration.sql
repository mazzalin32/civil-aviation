-- AlterTable
ALTER TABLE "User" ADD COLUMN     "welcomeDismissedAt" TIMESTAMP(3);

-- Anyone who has already signed in is past their first visit: no welcome card for them.
-- People invited but not yet signed in still see it the first time they arrive.
UPDATE "User" SET "welcomeDismissedAt" = now() WHERE "lastLoginAt" IS NOT NULL;

-- Earlier invites/resends each left their own working link. Keep only the newest per person.
DELETE FROM "Verification" v
USING "Verification" newer
WHERE v."identifier" LIKE 'reset-password:%'
  AND newer."identifier" LIKE 'reset-password:%'
  AND newer."value" = v."value"
  AND newer."createdAt" > v."createdAt";
