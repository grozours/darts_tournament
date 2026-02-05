-- Add persons table
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- Add unique index on email
CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");

-- Add person_id to players
ALTER TABLE "players" ADD COLUMN "person_id" TEXT;

-- Add foreign key
ALTER TABLE "players"
  ADD CONSTRAINT "players_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
