-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('ELIMINATORY', 'SWISS');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('REGISTRATION_OPEN', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentCoupleStatus" AS ENUM ('ACTIVE', 'ELIMINATED', 'FINALIST', 'CHAMPION', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TournamentMatchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'TIEBREAK', 'FINISHED', 'UNRESOLVED');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" "TournamentFormat" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'REGISTRATION_OPEN',
    "createdById" TEXT NOT NULL,
    "activeRound" INTEGER NOT NULL DEFAULT 0,
    "championId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_couples" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "status" "TournamentCoupleStatus" NOT NULL DEFAULT 'ACTIVE',
    "points" INTEGER NOT NULL DEFAULT 0,
    "matchesWon" INTEGER NOT NULL DEFAULT 0,
    "matchesLost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_couples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_solo_regs" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_solo_regs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_rounds" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,

    CONSTRAINT "tournament_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "couple0Id" TEXT NOT NULL,
    "couple1Id" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "status" "TournamentMatchStatus" NOT NULL DEFAULT 'PENDING',
    "score0" INTEGER NOT NULL DEFAULT 0,
    "score1" INTEGER NOT NULL DEFAULT 0,
    "roundsPlayed" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "roomId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_couples_tournamentId_user1Id_key" ON "tournament_couples"("tournamentId", "user1Id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_couples_tournamentId_user2Id_key" ON "tournament_couples"("tournamentId", "user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_solo_regs_tournamentId_userId_key" ON "tournament_solo_regs"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_rounds_tournamentId_roundNumber_key" ON "tournament_rounds"("tournamentId", "roundNumber");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_championId_fkey" FOREIGN KEY ("championId") REFERENCES "tournament_couples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_couples" ADD CONSTRAINT "tournament_couples_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_couples" ADD CONSTRAINT "tournament_couples_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_couples" ADD CONSTRAINT "tournament_couples_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_solo_regs" ADD CONSTRAINT "tournament_solo_regs_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_solo_regs" ADD CONSTRAINT "tournament_solo_regs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "tournament_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_couple0Id_fkey" FOREIGN KEY ("couple0Id") REFERENCES "tournament_couples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_couple1Id_fkey" FOREIGN KEY ("couple1Id") REFERENCES "tournament_couples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
