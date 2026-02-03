-- CreateEnum
CREATE TYPE "tournament_format" AS ENUM ('SINGLE', 'DOUBLE', 'TEAM_4_PLAYER');

-- CreateEnum
CREATE TYPE "duration_type" AS ENUM ('HALF_DAY_MORNING', 'HALF_DAY_AFTERNOON', 'HALF_DAY_NIGHT', 'FULL_DAY', 'TWO_DAY');

-- CreateEnum
CREATE TYPE "tournament_status" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "skill_level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "stage_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "pool_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "assignment_type" AS ENUM ('SEEDED', 'RANDOM', 'BYE');

-- CreateEnum
CREATE TYPE "bracket_type" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION');

-- CreateEnum
CREATE TYPE "bracket_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "target_status" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "logo_url" TEXT,
    "format" "tournament_format" NOT NULL,
    "duration_type" "duration_type" NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "total_participants" INTEGER NOT NULL,
    "target_count" INTEGER NOT NULL,
    "status" "tournament_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "historical_flag" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "skill_level" "skill_level",
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_stages" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "stage_number" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "pool_count" INTEGER NOT NULL,
    "players_per_pool" INTEGER NOT NULL,
    "advance_count" INTEGER NOT NULL,
    "status" "stage_status" NOT NULL DEFAULT 'NOT_STARTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "pool_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "pool_stage_id" TEXT NOT NULL,
    "pool_number" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "status" "pool_status" NOT NULL DEFAULT 'NOT_STARTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_assignments" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "assignment_type" "assignment_type" NOT NULL,
    "seed_number" INTEGER,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brackets" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "bracket_type" "bracket_type" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "total_rounds" INTEGER NOT NULL,
    "status" "bracket_status" NOT NULL DEFAULT 'NOT_STARTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bracket_entries" (
    "id" TEXT NOT NULL,
    "bracket_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "seed_number" INTEGER NOT NULL,
    "current_round" INTEGER NOT NULL,
    "is_eliminated" BOOLEAN NOT NULL DEFAULT false,
    "final_position" INTEGER,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bracket_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "target_number" INTEGER NOT NULL,
    "name" VARCHAR(50),
    "status" "target_status" NOT NULL DEFAULT 'AVAILABLE',
    "current_match_id" TEXT,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "pool_id" TEXT,
    "bracket_id" TEXT,
    "target_id" TEXT,
    "round_number" INTEGER NOT NULL,
    "match_number" INTEGER NOT NULL,
    "legs" INTEGER NOT NULL DEFAULT 1,
    "sets" INTEGER NOT NULL DEFAULT 1,
    "status" "match_status" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "winner_id" TEXT,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_matches" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "player_position" INTEGER NOT NULL,
    "score_total" INTEGER NOT NULL DEFAULT 0,
    "legs_won" INTEGER NOT NULL DEFAULT 0,
    "sets_won" INTEGER NOT NULL DEFAULT 0,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "player_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "leg_number" INTEGER NOT NULL,
    "dart_throw" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "is_finish" BOOLEAN NOT NULL DEFAULT false,
    "thrown_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_matches" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "scheduled_time" TIMESTAMP(3) NOT NULL,
    "estimated_duration" INTEGER NOT NULL,
    "sequence_order" INTEGER NOT NULL,

    CONSTRAINT "scheduled_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_tournament_id_email_key" ON "players"("tournament_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "players_tournament_id_first_name_last_name_key" ON "players"("tournament_id", "first_name", "last_name");

-- CreateIndex
CREATE UNIQUE INDEX "pool_stages_tournament_id_stage_number_key" ON "pool_stages"("tournament_id", "stage_number");

-- CreateIndex
CREATE UNIQUE INDEX "pools_pool_stage_id_pool_number_key" ON "pools"("pool_stage_id", "pool_number");

-- CreateIndex
CREATE UNIQUE INDEX "pool_assignments_pool_id_player_id_key" ON "pool_assignments"("pool_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "pool_assignments_pool_id_seed_number_key" ON "pool_assignments"("pool_id", "seed_number");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_entries_bracket_id_player_id_key" ON "bracket_entries"("bracket_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_entries_bracket_id_seed_number_key" ON "bracket_entries"("bracket_id", "seed_number");

-- CreateIndex
CREATE UNIQUE INDEX "targets_tournament_id_target_number_key" ON "targets"("tournament_id", "target_number");

-- CreateIndex
CREATE UNIQUE INDEX "player_matches_match_id_player_id_key" ON "player_matches"("match_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_matches_match_id_player_position_key" ON "player_matches"("match_id", "player_position");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_tournament_id_key" ON "schedules"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_matches_match_id_key" ON "scheduled_matches"("match_id");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_stages" ADD CONSTRAINT "pool_stages_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_pool_stage_id_fkey" FOREIGN KEY ("pool_stage_id") REFERENCES "pool_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_assignments" ADD CONSTRAINT "pool_assignments_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_assignments" ADD CONSTRAINT "pool_assignments_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brackets" ADD CONSTRAINT "brackets_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_entries" ADD CONSTRAINT "bracket_entries_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "brackets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_entries" ADD CONSTRAINT "bracket_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_current_match_id_fkey" FOREIGN KEY ("current_match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "brackets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_matches" ADD CONSTRAINT "player_matches_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_matches" ADD CONSTRAINT "player_matches_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
