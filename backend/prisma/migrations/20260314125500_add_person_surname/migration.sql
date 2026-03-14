-- Add optional surname to persons for self-service profile updates
ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "surname" VARCHAR(50);
