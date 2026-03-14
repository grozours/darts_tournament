-- Remove phone usage from persons and players
-- Re-introduce unique index on person email only
DROP INDEX IF EXISTS "persons_email_phone_key";
CREATE UNIQUE INDEX IF NOT EXISTS "persons_email_key" ON "persons"("email");

ALTER TABLE "persons" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "players" DROP COLUMN IF EXISTS "phone";
