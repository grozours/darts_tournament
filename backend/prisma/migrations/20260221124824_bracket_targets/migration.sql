-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "share_targets" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "target_start_number" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "bracket_targets" (
    "id" TEXT NOT NULL,
    "bracket_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bracket_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bracket_targets_bracket_id_target_id_key" ON "bracket_targets"("bracket_id", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_targets_target_id_key" ON "bracket_targets"("target_id");

-- AddForeignKey
ALTER TABLE "bracket_targets" ADD CONSTRAINT "bracket_targets_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "brackets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_targets" ADD CONSTRAINT "bracket_targets_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
