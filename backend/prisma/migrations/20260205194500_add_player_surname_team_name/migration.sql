-- Add surname and team name to players
ALTER TABLE "players"
  ADD COLUMN "surname" VARCHAR(50),
  ADD COLUMN "team_name" VARCHAR(100);
