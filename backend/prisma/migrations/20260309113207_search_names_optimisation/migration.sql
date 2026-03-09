/*
  Warnings:

  - The primary key for the `match_format_presets` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "match_format_presets" DROP CONSTRAINT "match_format_presets_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "match_format_presets_pkey" PRIMARY KEY ("id");
