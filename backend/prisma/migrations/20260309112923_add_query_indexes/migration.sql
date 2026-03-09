-- CreateIndex
CREATE INDEX "doublette_members_player_id_idx" ON "doublette_members"("player_id");

-- CreateIndex
CREATE INDEX "doublettes_tournament_id_is_registered_idx" ON "doublettes"("tournament_id", "is_registered");

-- CreateIndex
CREATE INDEX "doublettes_tournament_id_created_at_idx" ON "doublettes"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "equipe_members_player_id_idx" ON "equipe_members"("player_id");

-- CreateIndex
CREATE INDEX "equipes_tournament_id_is_registered_idx" ON "equipes"("tournament_id", "is_registered");

-- CreateIndex
CREATE INDEX "equipes_tournament_id_created_at_idx" ON "equipes"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "matches_bracket_id_round_number_match_number_idx" ON "matches"("bracket_id", "round_number", "match_number");

-- CreateIndex
CREATE INDEX "players_tournament_id_is_active_registered_at_idx" ON "players"("tournament_id", "is_active", "registered_at");

-- CreateIndex
CREATE INDEX "players_tournament_id_is_active_checked_in_idx" ON "players"("tournament_id", "is_active", "checked_in");

-- CreateIndex
CREATE INDEX "scores_match_id_idx" ON "scores"("match_id");

-- CreateIndex
CREATE INDEX "tournaments_status_created_at_idx" ON "tournaments"("status", "created_at");
