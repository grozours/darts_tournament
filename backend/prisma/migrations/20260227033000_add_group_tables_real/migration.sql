-- CreateTable
CREATE TABLE "doublettes" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "captain_player_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_registered" BOOLEAN NOT NULL DEFAULT false,
    "registered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doublettes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doublette_members" (
    "id" TEXT NOT NULL,
    "doublette_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doublette_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "captain_player_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_registered" BOOLEAN NOT NULL DEFAULT false,
    "registered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipe_members" (
    "id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipe_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doublettes_tournament_id_name_key" ON "doublettes"("tournament_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "doublettes_tournament_id_captain_player_id_key" ON "doublettes"("tournament_id", "captain_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "doublette_members_doublette_id_player_id_key" ON "doublette_members"("doublette_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_tournament_id_name_key" ON "equipes"("tournament_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_tournament_id_captain_player_id_key" ON "equipes"("tournament_id", "captain_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipe_members_equipe_id_player_id_key" ON "equipe_members"("equipe_id", "player_id");

-- AddForeignKey
ALTER TABLE "doublettes" ADD CONSTRAINT "doublettes_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doublettes" ADD CONSTRAINT "doublettes_captain_player_id_fkey" FOREIGN KEY ("captain_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doublette_members" ADD CONSTRAINT "doublette_members_doublette_id_fkey" FOREIGN KEY ("doublette_id") REFERENCES "doublettes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doublette_members" ADD CONSTRAINT "doublette_members_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_captain_player_id_fkey" FOREIGN KEY ("captain_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_members" ADD CONSTRAINT "equipe_members_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_members" ADD CONSTRAINT "equipe_members_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
