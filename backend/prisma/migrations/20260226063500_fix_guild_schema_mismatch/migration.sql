-- AlterTable
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "exclusiveRaidName" TEXT;
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "manualRaidProgress" TEXT;
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "mainRosterIncludedCharacterIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "mainRosterExcludedCharacterIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
