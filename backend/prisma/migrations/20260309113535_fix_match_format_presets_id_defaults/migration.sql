-- Safe corrective migration for accidental TEXT PK drift.
ALTER TABLE "match_format_presets" DROP CONSTRAINT "match_format_presets_pkey";

ALTER TABLE "match_format_presets"
ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "match_format_presets" ADD CONSTRAINT "match_format_presets_pkey" PRIMARY KEY ("id");
