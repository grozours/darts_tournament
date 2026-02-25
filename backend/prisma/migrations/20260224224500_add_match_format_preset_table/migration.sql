CREATE TABLE IF NOT EXISTS "match_format_presets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(20) NOT NULL UNIQUE,
  "duration_minutes" INTEGER NOT NULL,
  "segments" JSONB NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "match_format_presets" ("key", "duration_minutes", "segments", "is_system")
VALUES
  ('BO3', 30, '[{"game":"501_DO","targetCount":4},{"game":"CRICKET","targetCount":2},{"game":"501_DO","targetCount":2}]'::jsonb, true),
  ('BO5', 60, '[{"game":"501_DO","targetCount":4},{"game":"CRICKET","targetCount":2},{"game":"501_DO","targetCount":4},{"game":"CRICKET","targetCount":2},{"game":"501_DO","targetCount":2}]'::jsonb, true),
  ('BO5_F', 60, '[{"game":"501_DO","targetCount":4},{"game":"CRICKET","targetCount":2},{"game":"501_DO","targetCount":4},{"game":"CRICKET","targetCount":2},{"game":"701_DO","targetCount":2}]'::jsonb, true)
ON CONFLICT ("key") DO NOTHING;
