-- CreateTable
CREATE TABLE "tournament_presets" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "preset_type" VARCHAR(50) NOT NULL,
    "total_participants" INTEGER NOT NULL,
    "target_count" INTEGER NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_presets_name_key" ON "tournament_presets"("name");

-- Seed default presets
INSERT INTO "tournament_presets" (
    "id",
    "name",
    "preset_type",
    "total_participants",
    "target_count",
    "is_system",
    "created_at",
    "updated_at"
)
VALUES
    (
      '00000000-0000-4000-8000-000000000101',
      'Single pool stage',
      'single-pool-stage',
      16,
      4,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ),
    (
      '00000000-0000-4000-8000-000000000102',
      'Three pool stages',
      'three-pool-stages',
      16,
      4,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
ON CONFLICT ("name") DO NOTHING;
