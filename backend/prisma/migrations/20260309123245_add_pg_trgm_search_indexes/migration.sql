-- Enable trigram support for ILIKE/contains-style searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Player search fields used with contains + mode: insensitive
CREATE INDEX IF NOT EXISTS players_first_name_trgm_idx ON players USING gin (lower(first_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS players_last_name_trgm_idx ON players USING gin (lower(last_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS players_surname_trgm_idx ON players USING gin (lower(surname) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS players_team_name_trgm_idx ON players USING gin (lower(team_name) gin_trgm_ops);

-- Group name search fields
CREATE INDEX IF NOT EXISTS doublettes_name_trgm_idx ON doublettes USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS equipes_name_trgm_idx ON equipes USING gin (lower(name) gin_trgm_ops);
