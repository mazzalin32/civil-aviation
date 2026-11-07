-- Data only (no schema change): suspicious-activity alerts (spec §5.9, FLOWS §15).

-- Security alerts now show in the Admin's bell as well as by email.
UPDATE "NotificationRule" SET "channels" = array_prepend('IN_APP', "channels")
WHERE "trigger" = 'SUSPICIOUS_ACTIVITY' AND NOT ('IN_APP' = ANY("channels"));

-- Default mass-download policy (Settings → Security): alert at 50 different files in 10 minutes; auto-lock off.
INSERT INTO "Setting" ("key", "value", "updatedAt")
VALUES ('security.massDownload', '{"files": 50, "minutes": 10, "autoLock": false}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
