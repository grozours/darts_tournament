/*
  Warnings:

  - The values [REGISTRATION_OPEN,IN_PROGRESS,COMPLETED,ARCHIVED] on the enum `tournament_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "stage_status" ADD VALUE 'EDITION';

-- AlterEnum
BEGIN;
CREATE TYPE "tournament_status_new" AS ENUM ('DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED');
ALTER TABLE "tournaments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tournaments" ALTER COLUMN "status" TYPE "tournament_status_new" USING ("status"::text::"tournament_status_new");
ALTER TYPE "tournament_status" RENAME TO "tournament_status_old";
ALTER TYPE "tournament_status_new" RENAME TO "tournament_status";
DROP TYPE "tournament_status_old";
ALTER TABLE "tournaments" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "players" DROP CONSTRAINT "players_tournament_id_fkey";

-- AlterTable
ALTER TABLE "persons" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "checked_in" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "tournament_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
