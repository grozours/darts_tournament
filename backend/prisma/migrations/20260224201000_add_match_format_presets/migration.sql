ALTER TABLE "pool_stages"
ADD COLUMN IF NOT EXISTS "match_format_key" VARCHAR(20);

ALTER TABLE "brackets"
ADD COLUMN IF NOT EXISTS "round_match_formats" JSONB;

ALTER TABLE "matches"
ADD COLUMN IF NOT EXISTS "match_format_key" VARCHAR(20);
