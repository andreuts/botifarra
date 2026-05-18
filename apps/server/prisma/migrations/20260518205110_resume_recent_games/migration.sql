-- AlterEnum
ALTER TYPE "MatchStatus" ADD VALUE 'ABANDONED';

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "lastSnapshot" JSONB;

-- CreateTable
CREATE TABLE "elo_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "eloAfter" DOUBLE PRECISION NOT NULL,
    "eloChange" DOUBLE PRECISION NOT NULL,
    "isRanked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elo_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "elo_history_userId_createdAt_idx" ON "elo_history"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
