-- AlterTable
ALTER TABLE "guilds" ADD COLUMN     "adminRanks" INTEGER[] DEFAULT ARRAY[0]::INTEGER[];
