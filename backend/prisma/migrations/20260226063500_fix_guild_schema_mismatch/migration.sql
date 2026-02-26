-- AlterTable
ALTER TABLE "guilds" ADD COLUMN "exclusiveRaidName" TEXT,
ADD COLUMN "mainRosterIncludedCharacterIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "mainRosterExcludedCharacterIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
