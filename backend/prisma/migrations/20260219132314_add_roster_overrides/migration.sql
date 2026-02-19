-- AlterTable
ALTER TABLE "rosters" ADD COLUMN     "excludedCharacterIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "includedCharacterIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
