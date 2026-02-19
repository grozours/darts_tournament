-- Add double stage flag to tournaments
ALTER TABLE "tournaments"
ADD COLUMN "double_stage_enabled" BOOLEAN NOT NULL DEFAULT false;
