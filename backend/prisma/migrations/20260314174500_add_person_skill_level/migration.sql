ALTER TABLE "persons"
ADD COLUMN IF NOT EXISTS "skill_level" "skill_level";

-- Backfill person skill level from the latest active player linked to each person.
UPDATE "persons" AS p
SET "skill_level" = sub."skill_level"
FROM (
  SELECT DISTINCT ON (pl."person_id")
    pl."person_id",
    pl."skill_level"
  FROM "players" AS pl
  WHERE pl."person_id" IS NOT NULL
    AND pl."is_active" = TRUE
    AND pl."skill_level" IS NOT NULL
  ORDER BY pl."person_id", pl."registered_at" DESC
) AS sub
WHERE p."id" = sub."person_id"
  AND p."skill_level" IS NULL;
