-- Add target_code to targets
ALTER TABLE "targets" ADD COLUMN "target_code" VARCHAR(50);

-- Backfill target_code using target_number
UPDATE "targets"
SET "target_code" = 'target' || "target_number"::text
WHERE "target_code" IS NULL;

-- Enforce not-null after backfill
ALTER TABLE "targets" ALTER COLUMN "target_code" SET NOT NULL;

-- Ensure uniqueness per tournament
CREATE UNIQUE INDEX "targets_tournament_id_target_code_key" ON "targets"("tournament_id", "target_code");
