ALTER TABLE "profiles" ADD COLUMN "auto_download_vcard" boolean DEFAULT true NOT NULL;--> statement-breakpoint

-- Carry over the setting from cards: a profile stays on if any of its live cards
-- had it on, and goes off if it has live cards and all had it off. Profiles with
-- no card keep the default.
UPDATE "profiles" p SET "auto_download_vcard" = false
WHERE EXISTS (SELECT 1 FROM "cards" c WHERE c."profile_id" = p."id" AND NOT c."archived")
  AND NOT EXISTS (SELECT 1 FROM "cards" c WHERE c."profile_id" = p."id" AND NOT c."archived" AND c."auto_download_vcard");
