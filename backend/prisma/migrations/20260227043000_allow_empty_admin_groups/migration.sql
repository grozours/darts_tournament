-- DropForeignKey
ALTER TABLE "doublettes" DROP CONSTRAINT "doublettes_captain_player_id_fkey";

-- DropForeignKey
ALTER TABLE "equipes" DROP CONSTRAINT "equipes_captain_player_id_fkey";

-- AlterTable
ALTER TABLE "doublettes" ALTER COLUMN "captain_player_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "equipes" ALTER COLUMN "captain_player_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "doublettes" ADD CONSTRAINT "doublettes_captain_player_id_fkey" FOREIGN KEY ("captain_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_captain_player_id_fkey" FOREIGN KEY ("captain_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
