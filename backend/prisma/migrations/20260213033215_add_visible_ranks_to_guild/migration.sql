-- AlterTable
ALTER TABLE "guilds" ADD COLUMN     "visibleRanks" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4]::INTEGER[];
