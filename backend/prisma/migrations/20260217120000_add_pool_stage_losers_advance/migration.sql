-- Add flag for loser bracket advancement
ALTER TABLE "pool_stages"
ADD COLUMN "losers_advance_to_bracket" BOOLEAN NOT NULL DEFAULT false;
