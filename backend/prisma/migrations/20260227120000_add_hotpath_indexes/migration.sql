-- Add indexes for frequent filters/joins on live tournament queries

CREATE INDEX IF NOT EXISTS "tournaments_status_idx" ON "tournaments"("status");
CREATE INDEX IF NOT EXISTS "pool_stages_status_idx" ON "pool_stages"("status");
CREATE INDEX IF NOT EXISTS "pools_status_idx" ON "pools"("status");
CREATE INDEX IF NOT EXISTS "brackets_tournament_id_idx" ON "brackets"("tournament_id");
CREATE INDEX IF NOT EXISTS "brackets_status_idx" ON "brackets"("status");
CREATE INDEX IF NOT EXISTS "targets_status_idx" ON "targets"("status");
CREATE INDEX IF NOT EXISTS "matches_tournament_id_idx" ON "matches"("tournament_id");
CREATE INDEX IF NOT EXISTS "matches_status_idx" ON "matches"("status");
CREATE INDEX IF NOT EXISTS "matches_bracket_id_idx" ON "matches"("bracket_id");
CREATE INDEX IF NOT EXISTS "matches_target_id_idx" ON "matches"("target_id");
CREATE INDEX IF NOT EXISTS "scheduled_matches_target_id_idx" ON "scheduled_matches"("target_id");
