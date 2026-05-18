-- AlterEnum
ALTER TYPE "MatchMode" ADD VALUE 'RANKED';

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "endReason" TEXT,
ADD COLUMN     "ranked" BOOLEAN NOT NULL DEFAULT false;
