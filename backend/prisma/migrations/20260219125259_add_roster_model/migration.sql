-- AlterTable
ALTER TABLE "raids" ADD COLUMN     "rosterId" INTEGER;

-- CreateTable
CREATE TABLE "rosters" (
    "id" SERIAL NOT NULL,
    "guildId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "allowedRanks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rosters_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raids" ADD CONSTRAINT "raids_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "rosters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
